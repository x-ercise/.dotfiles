//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const vscode_1 = require("vscode");
const vscode_jsonrpc_1 = require("vscode-jsonrpc");
const semver = require("semver");
const config = require("../config");
const VSLS_1 = require("../contracts/VSLS");
const vsls = require("../contracts/VSLS");
const service_1 = require("../workspace/service");
const traceSource_1 = require("../tracing/traceSource");
const remoteServiceTelemetry_1 = require("../telemetry/remoteServiceTelemetry");
const workspaceTaskTelemetry_1 = require("./workspaceTaskTelemetry");
const restrictedOperation_1 = require("../accessControl/restrictedOperation");
let workspaceTaskService;
async function enable(rpcClient, workspaceService, clientAccessCheck) {
    if (config.featureFlags.workspaceTask) {
        if (semver.gte(semver.coerce(vscode.version), '1.24.0') &&
            !!vscode_1.tasks.onDidStartTask) {
            workspaceTaskService = new WorkspaceTaskService(rpcClient, workspaceService, config.get(config.Key.allowGuestTaskControl), clientAccessCheck);
            await workspaceTaskService.initialize();
        }
    }
}
exports.enable = enable;
async function disable() {
    if (workspaceTaskService) {
        await workspaceTaskService.dispose();
        workspaceTaskService = undefined;
    }
}
exports.disable = disable;
class WorkspaceTaskService {
    constructor(rpcClient, workspaceService, enableTaskControl, clientAccessCheck) {
        this.rpcClient = rpcClient;
        this.workspaceService = workspaceService;
        this.enableTaskControl = enableTaskControl;
        this.clientAccessCheck = clientAccessCheck;
        this.taskOutputCache = {};
        this.subscriptions = [];
        this.taskExecutions = [];
        this.completedExecutions = [];
        this.deferredInit = Promise.resolve();
        this.dataProcessQueue = Promise.resolve();
        this.taskOutputService = service_1.RpcProxy.create(VSLS_1.TaskOutputService, this.rpcClient, vsls.TraceSources.ClientRpc);
        this.streamManagerService = service_1.RpcProxy.create(VSLS_1.StreamManagerService, this.rpcClient, vsls.TraceSources.ClientRpc);
        this.streamService = service_1.RpcProxy.create(VSLS_1.StreamService, this.rpcClient, vsls.TraceSources.ClientRpc);
        this.trace = traceSource_1.traceSource.withName('WorkspaceTaskService');
    }
    async initialize() {
        if (this.enableTaskControl) {
            this.subscriptions.push(vscode_1.tasks.onDidStartTask(e => this.handleTaskStarted(e.execution)), vscode_1.tasks.onDidEndTask(e => this.handleTaskEnded(e.execution)));
        }
        if (vscode_1.window.onDidOpenTerminal) {
            this.subscriptions.push(vscode_1.window.onDidOpenTerminal(async (terminal) => {
                if (terminal.name.startsWith('Task')) {
                    await this.createTaskOutput(terminal);
                }
            }));
        }
        this.deferredInit = this.deferredInit.then(() => this.initializeContext()).catch(() => { });
    }
    async initializeContext() {
        if (this.enableTaskControl) {
            this.rpcClient.addRequestMethod('workspaceTask.getSupportedTasks', () => this.getSupportedTasks());
            this.rpcClient.addRequestMethod('workspaceTask.getTaskExecutions', () => this.getTaskExecutions());
            this.rpcClient.addRequestMethodWithContext('workspaceTask.runTask', (taskNameOrUid, context) => this.runTask(taskNameOrUid, context));
            this.rpcClient.addRequestMethod('workspaceTask.terminateTask', (taskExecution) => this.terminateTask(taskExecution));
            await this.workspaceService.registerServicesAsync(['workspaceTask'], vsls.WorkspaceServicesChangeType.Add);
        }
        for (const terminal of vscode_1.window.terminals.filter(x => x.name.startsWith('Task'))) {
            await this.createTaskOutput(terminal);
        }
    }
    async dispose() {
        await this.deferredInit;
        this.subscriptions.forEach(d => d.dispose());
        Object.keys(this.taskOutputCache)
            .map(x => this.taskOutputCache[x])
            .forEach(d => d.dispose());
        if (this.enableTaskControl) {
            await this.workspaceService.registerServicesAsync(['workspaceTask'], vsls.WorkspaceServicesChangeType.Remove);
            this.rpcClient.removeRequestMethod('workspaceTask.getSupportedTasks');
            this.rpcClient.removeRequestMethod('workspaceTask.getTaskExecutions');
            this.rpcClient.removeRequestMethod('workspaceTask.runTask');
            this.rpcClient.removeRequestMethod('workspaceTask.terminateTask');
            const v0 = {};
            const executionsByKind = this.completedExecutions.reduce((ebk, entry) => (Object.assign({}, ebk, { [entry[0]]: [...(ebk[entry[0]] || []), entry[1]] })), v0);
            Object.keys(executionsByKind).forEach(taskKind => {
                workspaceTaskTelemetry_1.WorkspaceTaskTelemetry.sendExecutionSummary(taskKind, executionsByKind[taskKind]);
            });
        }
    }
    async createTaskOutput(taskTerminal) {
        const taskOutput = await this.taskOutputService.shareTaskOutputAsync(taskTerminal.name, { contentType: vsls.TaskOutputContentType.TextWithAnsiEscapeCodes });
        const streamMoniker = taskOutput.feed.streamMoniker;
        const streamId = await this.streamManagerService.getStreamAsync(streamMoniker.name, streamMoniker.condition);
        const registrations = [];
        const subscribeDataListener = (event) => {
            event((data) => {
                this.dataProcessQueue = this.dataProcessQueue
                    .then(() => processData(data))
                    .catch((e) => {
                    const errorMsg = 'Rejected promise while processing terminal data';
                    this.trace.error(errorMsg);
                });
            }, null, registrations);
        };
        if ('onDidWriteData' in taskTerminal) {
            subscribeDataListener(taskTerminal.onDidWriteData);
        }
        else if ('onData' in taskTerminal) {
            subscribeDataListener(taskTerminal.onData);
        }
        const processData = async (data) => {
            const encoded = Buffer.from(data).toString('base64');
            await this.rpcClient.sendRequest(this.trace, 'stream.writeBytes', null, null, streamId, 'x' + encoded);
        };
        const onDidCloseTerminal = (e) => {
            if (e === taskTerminal) {
                disposeTaskOutput();
            }
        };
        vscode_1.window.onDidCloseTerminal(onDidCloseTerminal, null, registrations);
        const disposeTaskOutput = async () => {
            delete this.taskOutputCache[taskTerminal.name];
            registrations.forEach(x => x.dispose());
            await this.streamService.disposeStreamAsync(streamId);
            await this.taskOutputService.closeTaskOutputAsync(taskOutput.id);
        };
        this.taskOutputCache[taskTerminal.name] = {
            terminal: taskTerminal,
            taskOutput: taskOutput,
            streamId: streamId,
            dispose: disposeTaskOutput
        };
    }
    async getSupportedTasks() {
        try {
            const allTasks = await vscode_1.tasks.fetchTasks();
            const workspaceTasks = allTasks.map(WorkspaceTaskService.getWorkspaceTask);
            return workspaceTasks;
        }
        catch (error) {
            remoteServiceTelemetry_1.RemoteServiceTelemetry.sendServiceFault(WorkspaceTaskService.SERVICE_NAME, 'getSupportedTasks', error);
            return new vscode_jsonrpc_1.ResponseError(vscode_jsonrpc_1.ErrorCodes.UnknownErrorCode, error.message, error.stack);
        }
    }
    getTaskExecutions() {
        try {
            return Promise.resolve(this.taskExecutions.map(x => x[0]));
        }
        catch (error) {
            remoteServiceTelemetry_1.RemoteServiceTelemetry.sendServiceFault(WorkspaceTaskService.SERVICE_NAME, 'getTaskExecutions', error);
            return new vscode_jsonrpc_1.ResponseError(vscode_jsonrpc_1.ErrorCodes.UnknownErrorCode, error.message, error.stack);
        }
    }
    async runTask(taskUidOrName, context) {
        let result = { status: vsls.RunTaskStatus.TaskNotFound };
        try {
            const allTasks = await vscode_1.tasks.fetchTasks();
            const taskToRun = allTasks.filter(x => x.name === taskUidOrName || WorkspaceTaskService.getTaskUid(x) === taskUidOrName)[0];
            if (taskToRun) {
                if (!await this.clientAccessCheck().canPerformOperation(context, WorkspaceTaskService.runTaskOperation)) {
                    return { status: vsls.RunTaskStatus.RejectedByHost };
                }
                const execution = await vscode_1.tasks.executeTask(taskToRun);
                const moniker = WorkspaceTaskService.createMoniker(execution);
                this.taskExecutions.push([moniker, { execution: execution, startTime: Date.now() }]);
                result = { status: vsls.RunTaskStatus.Started, taskExecution: moniker };
            }
        }
        catch (error) {
            remoteServiceTelemetry_1.RemoteServiceTelemetry.sendServiceFault(WorkspaceTaskService.SERVICE_NAME, 'runTask', error);
            return new vscode_jsonrpc_1.ResponseError(vscode_jsonrpc_1.ErrorCodes.UnknownErrorCode, error.message, error.stack);
        }
        return result;
    }
    async terminateTask(taskExecution) {
        try {
            const entry = this.taskExecutions.find(x => x[0].id === taskExecution.id);
            if (!!entry) {
                const execution = entry[1].execution;
                await execution.terminate();
            }
        }
        catch (error) {
            remoteServiceTelemetry_1.RemoteServiceTelemetry.sendServiceFault(WorkspaceTaskService.SERVICE_NAME, 'terminateTask', error);
            return new vscode_jsonrpc_1.ResponseError(vscode_jsonrpc_1.ErrorCodes.UnknownErrorCode, error.message, error.stack);
        }
    }
    async handleTaskStarted(execution) {
        const entry = this.taskExecutions.find(x => x[1].execution === execution);
        let moniker = undefined;
        if (!!entry) {
            // task started by us programmatically
            moniker = entry[0];
        }
        else {
            // task started by a user
            moniker = WorkspaceTaskService.createMoniker(execution);
            this.taskExecutions.push([moniker, { execution: execution, startTime: Date.now() }]);
        }
        await this.rpcClient.sendNotification(this.trace, 'workspaceTask.taskStarted', {
            taskExecution: moniker,
            change: vsls.TaskExecutionStatusChange.Started,
            task: WorkspaceTaskService.getWorkspaceTask(execution.task)
        });
    }
    async handleTaskEnded(execution) {
        const index = this.taskExecutions.findIndex(x => x[1].execution === execution);
        if (index > -1) {
            const entry = this.taskExecutions[index];
            const kind = WorkspaceTaskService.getTaskKind(entry[1].execution.task) || 'Unknown';
            const elapsed = Date.now() - entry[1].startTime;
            this.completedExecutions.push([kind, elapsed]);
            await this.rpcClient.sendNotification(this.trace, 'workspaceTask.taskTerminated', {
                taskExecution: entry[0],
                change: vsls.TaskExecutionStatusChange.Terminated,
                task: WorkspaceTaskService.getWorkspaceTask(execution.task)
            });
            this.taskExecutions.splice(index, 1);
        }
    }
    static getTaskUid(task) {
        return `${task.definition.type}:${task.name}`;
    }
    static getTaskKind(task) {
        switch (task.group) {
            case vscode.TaskGroup.Build:
                return 'build';
            case vscode.TaskGroup.Clean:
                return 'clean';
            case vscode.TaskGroup.Rebuild:
                return 'rebuild';
            case vscode.TaskGroup.Test:
                return 'test';
            default:
                return undefined;
        }
    }
    static getWorkspaceTask(task) {
        const result = {
            uniqueId: WorkspaceTaskService.getTaskUid(task),
            name: task.name,
            source: task.source,
            kind: WorkspaceTaskService.getTaskKind(task)
        };
        switch (task.scope) {
            case vscode.TaskScope.Global:
                result.scope = vsls.TaskScope.Global;
                break;
            case vscode.TaskScope.Workspace:
                result.scope = vsls.TaskScope.Workspace;
                break;
            default:
                // Assume that since it's not an existing task scope, it must be
                // a workspace folder.
                result.scope = vsls.TaskScope.WorkspaceFolder;
                result.owningWorkspace = task.scope.index.toString();
                break;
        }
        return result;
    }
    static createMoniker(execution) {
        const taskUid = WorkspaceTaskService.getTaskUid(execution.task);
        return {
            id: `${taskUid}:${++WorkspaceTaskService.taskExecutionCounter}`,
            taskUid: taskUid
        };
    }
}
WorkspaceTaskService.SERVICE_NAME = 'workspaceTask';
WorkspaceTaskService.taskExecutionCounter = 0;
WorkspaceTaskService.runTaskOperation = { name: restrictedOperation_1.WellKnownRestrictedOperations.RunTask };

//# sourceMappingURL=workspaceTaskService.js.map
