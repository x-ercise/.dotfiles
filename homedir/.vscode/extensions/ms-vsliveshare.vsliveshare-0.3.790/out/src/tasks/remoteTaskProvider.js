'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const url = require("url");
const vsls = require("../contracts/VSLS");
const agent_1 = require("../agent");
const config = require("../config");
const path = require("path");
exports.liveShareTaskType = 'vsls';
let internalContext;
/**
 * Registers the Live Share workspace task provider.
 */
function register() {
    const taskProvider = vscode.workspace.registerTaskProvider(exports.liveShareTaskType, {
        provideTasks: () => getWorkspaceTasks(),
        resolveTask: () => undefined
    });
    return taskProvider;
}
exports.register = register;
/**
 * Initializes the internal context and returns its instance.
 * @param brokerToken The token value used to authorize a broker process.
 * @param fetchTasks The predicate to retrieve a list of all remote workspace tasks.
 * @param fetchTaskExecutions The predicate to retrieve a list of active task executions on the host.
 */
function configure(brokerToken, fetchTasks, fetchTaskExecutions) {
    internalContext = {
        brokerToken: brokerToken,
        fetchTasks: fetchTasks,
        fetchTaskExecutions: fetchTaskExecutions,
        dispose: () => {
            internalContext = undefined;
        }
    };
    return internalContext;
}
exports.configure = configure;
async function getWorkspaceTasks() {
    const result = [];
    if (!internalContext || !agent_1.Agent.IsRunning) {
        return result;
    }
    const taskExecutions = internalContext.fetchTaskExecutions();
    if (!!taskExecutions && !!taskExecutions.length) {
        // if task executions list is provided, then build monitor tasks only
        for (const [taskOnHost, taskExecution] of taskExecutions) {
            const workspaceTask = buildWorkspaceTask(taskOnHost, taskExecution);
            result.push(workspaceTask);
        }
    }
    else {
        // build regular workspace tasks otherwise
        const tasksOnHost = await internalContext.fetchTasks();
        for (const taskOnHost of tasksOnHost) {
            const workspaceTask = buildWorkspaceTask(taskOnHost);
            result.push(workspaceTask);
        }
    }
    return result;
}
function buildWorkspaceTask(taskOnHost, taskExecution) {
    const diagnosticLogging = config.get(config.Key.diagnosticLogging);
    const loggingArgs = diagnosticLogging ? ['--verbosity', 'Verbose'] : ['--verbosity', 'Information'];
    const brokerArgs = [
        '--broker-token',
        internalContext.brokerToken,
        '--agent-uri',
        url.format(agent_1.Agent.uri),
        '--virtual-terminal'
    ];
    let scope;
    switch (taskOnHost.scope) {
        case vsls.TaskScope.WorkspaceFolder:
            // Since it's a workspace folder, we need to do some work
            // to find the actual workspace folder this should be associated with
            const workspaceIndex = parseInt(taskOnHost.owningWorkspace, 10);
            scope = vscode.workspace.workspaceFolders[workspaceIndex];
            break;
        case vsls.TaskScope.Workspace:
            scope = vscode.TaskScope.Workspace;
            break;
        case vsls.TaskScope.Global:
            scope = vscode.TaskScope.Global;
            break;
        default:
            // Default is assumed to be associated with a workspace folder.
            // Primarily this is for tasks coming from VS which inherently are
            // associated with a single workspace folder
            scope = vscode.workspace.workspaceFolders[0];
            break;
    }
    // create a workspace task to launch a task on the host
    const kind = {
        type: exports.liveShareTaskType,
        taskUid: taskOnHost.uniqueId
    };
    const processExecution = new vscode.ProcessExecution(agent_1.Agent.getAgentPath(), [
        ...loggingArgs,
        'run-task',
        taskOnHost.uniqueId,
    ], {
        cwd: path.dirname(agent_1.Agent.getAgentPath())
    });
    if (!!taskExecution) {
        // create a workspace task to monitor a task execution on the host
        // if it was already in progress.
        kind.executionId = taskExecution.id;
        processExecution.args.push('--monitor', taskExecution.id);
    }
    processExecution.args.push(...brokerArgs);
    const task = new vscode.Task(kind, scope, taskOnHost.name, taskOnHost.source ? taskOnHost.source : 'Shared', processExecution);
    switch (taskOnHost.kind) {
        case 'build':
            task.group = vscode.TaskGroup.Build;
            break;
        case 'clean':
            task.group = vscode.TaskGroup.Clean;
            break;
        case 'rebuild':
            task.group = vscode.TaskGroup.Rebuild;
            break;
        case 'test':
            task.group = vscode.TaskGroup.Test;
            break;
        default:
            break;
    }
    task.presentationOptions = {
        reveal: vscode.TaskRevealKind.Never,
        echo: diagnosticLogging,
        focus: false,
        panel: vscode.TaskPanelKind.Shared
    };
    task.isBackground = true;
    task.problemMatchers = ['$vsls'];
    return task;
}

//# sourceMappingURL=remoteTaskProvider.js.map
