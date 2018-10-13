"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
const rpc = require("vscode-jsonrpc");
const vscode = require("vscode");
const net = require("net");
const uuid = require("uuid");
const traceSource_1 = require("../tracing/traceSource");
const util = require("../util");
const stdfork = require("./stdFork");
const restrictedOperation_1 = require("../accessControl/restrictedOperation");
exports.sourceEventNotificationType = new rpc.NotificationType('sourceEvent.event');
class HostAdapterService {
    constructor(client, clientAccessCheck) {
        this.client = client;
        this.rpcConnections = [];
        this.runInTerminal = null;
        this.trace = traceSource_1.traceSource.withName(traceSource_1.TraceSources.DebugRpcHost);
        this.pipeName = uuid().replace(/-/g, '');
        let self = this;
        let logger;
        logger = this;
        this.server = net.createServer(function (socket) {
            let pipeConnection = rpc.createMessageConnection(socket, socket, logger);
            self.rpcConnections.push(pipeConnection);
            // Support for 'sendRequest' request
            const invokeType = new rpc.RequestType('VSCodeAdapterService.sendRequest');
            pipeConnection.onRequest(invokeType, async (values) => {
                const command = values[0];
                values.splice(0, 1);
                let response = await client.sendRequest(self.trace, command, null, null, ...values);
                return response;
            });
            // Support for 'sendNotification' request
            const sendNotificationType = new rpc.NotificationType('VSCodeAdapterService.sendNotification');
            pipeConnection.onNotification(sendNotificationType, async (values) => {
                const eventName = values[0];
                await client.sendNotification(self.trace, eventName, values[1]);
            });
            // Support for register service request
            const registerServiceType = new rpc.RequestType('VSCodeAdapterService.registerService');
            pipeConnection.onRequest(registerServiceType, async (values) => {
                // Register the Service on our workspace
                const serviceName = values[0];
                await client.sendRequest(self.trace, 'workspace.registerServices', null, null, [serviceName], 'Add');
                const requestMethods = values[1];
                for (let methodName of requestMethods) {
                    client.addRequestMethodWithContext(methodName, async (...params) => {
                        // Get context from the second-to-last parameter and remove it from the parameters.
                        const context = params[params.length - 2];
                        params.splice(params.length - 2, 1);
                        // Check if the operation is allowed.
                        const restrictedOperation = HostAdapterService.getRestrictedOperation(methodName, params);
                        await clientAccessCheck().verifyCanPerformOperation(context, restrictedOperation);
                        // Forward the request to the pipe connection.
                        let response = await pipeConnection.sendRequest(methodName, params);
                        return response;
                    });
                }
            });
            // Support for unregister service request
            const unregisterServiceType = new rpc.RequestType('VSCodeAdapterService.unregisterService');
            pipeConnection.onRequest(unregisterServiceType, async (values) => {
                // Unregister the Service on our workspace
                // Param 0: serviceName
                // Param 1: list of methods to unregister
                const serviceName = values[0];
                await client.sendRequest(self.trace, 'workspace.registerServices', null, null, [serviceName], 'Remove');
                const requestMethods = values[1];
                for (let methodName of requestMethods) {
                    client.removeRequestMethod(methodName);
                }
            });
            // Support for register notifications
            const registerNotificationsType = new rpc.RequestType('VSCodeAdapterService.registerNotifications');
            pipeConnection.onRequest(registerNotificationsType, async (values) => {
                let cookies = [];
                for (let eventName of values) {
                    const cookie = client.addNotificationHandler(eventName, async (...params) => {
                        await pipeConnection.sendNotification(eventName, ...params);
                    });
                    cookies.push(cookie);
                }
                return cookies;
            });
            // Support for unregister notifications
            const unregisterNotificationsType = new rpc.RequestType('VSCodeAdapterService.unregisterNotifications');
            pipeConnection.onRequest(unregisterNotificationsType, async (values) => {
                for (let entry of values) {
                    client.removeNotificationHandler(entry.name, entry.cookie);
                }
            });
            // Support for request received service request
            const requestReceivedType = new rpc.RequestType('VSCodeAdapterService.requestReceived');
            pipeConnection.onRequest(requestReceivedType, async (values) => {
                const command = values[0];
                const requestArgs = values[1];
                if (command === 'runInTerminal' && self.runInTerminal) {
                    const result = await self.runInTerminal(requestArgs);
                    if (result && result.response) {
                        return {
                            handled: true,
                            response: result.response
                        };
                    }
                    else {
                        return {
                            arguments: result && result.args ? result.args : requestArgs
                        };
                    }
                }
                return { handled: false };
            });
            // Support for 'enterRunMode' request
            const enterRunRequestType = new rpc.RequestType('VSCodeAdapterService.enterRunMode');
            pipeConnection.onRequest(enterRunRequestType, async (values) => {
                let reason = values[0];
                console.log(`HostAdapterService::enterRunMode:${reason}`);
                if (reason === 'go') {
                    await vscode.commands.executeCommand('workbench.action.debug.continue');
                }
                else if (reason === 'step') {
                    await vscode.commands.executeCommand('workbench.action.debug.stepOver');
                }
            });
            const nodeForkType = new rpc.RequestType('VSCodeAdapterService.nodeFork');
            let stdforkHandler = (values) => new Promise((resolve, reject) => {
                stdfork.fork(self.trace, values[0], (err, child, processInfo) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(processInfo);
                    }
                });
            });
            pipeConnection.onRequest(nodeForkType, stdforkHandler);
            pipeConnection.onClose((e) => {
                let index = self.rpcConnections.indexOf(pipeConnection);
                if (index > -1) {
                    self.rpcConnections.splice(index, 1);
                }
            });
            pipeConnection.listen();
        });
        let launchCallback = (error) => {
        };
        //this.server.on("error", this.recoverServer.bind(this));
        this.server.listen(util.getPipePath(this.pipeName), launchCallback);
    }
    dispose() {
        this.server.close();
    }
    static getRestrictedOperation(methodName, params) {
        if (HostAdapterService.isContinueRequest(methodName)) {
            return HostAdapterService.debugContinueOperation;
        }
        if (HostAdapterService.isSetVariableRequest(methodName, params)) {
            return HostAdapterService.debugSetVariableOperation;
        }
        if (HostAdapterService.isEvaluateRequest(methodName, params)) {
            return HostAdapterService.debugEvaluateOperation;
        }
        return null;
    }
    static isContinueRequest(methodName) {
        return methodName && typeof methodName === 'string' && methodName.endsWith('.continue');
    }
    static isSetVariableRequest(methodName, params) {
        return methodName && typeof methodName === 'string' && methodName.endsWith('.handleProtocolRequest') &&
            params && Array.isArray(params) && params.length > 0 && params[0] === 'setVariable';
    }
    static isEvaluateRequest(methodName, params) {
        return methodName && typeof methodName === 'string' && methodName.endsWith('.handleProtocolRequest') &&
            params && Array.isArray(params) && params.length > 1 && params[0] === 'evaluate'
            && params[1] && params[1].context !== 'hover';
    }
    // Implement Logger
    error(message) { }
    warn(message) { }
    info(message) { }
    log(message) { }
}
HostAdapterService.debugContinueOperation = { name: restrictedOperation_1.WellKnownRestrictedOperations.DebugContinue };
HostAdapterService.debugSetVariableOperation = { name: restrictedOperation_1.WellKnownRestrictedOperations.DebugSetVariable };
HostAdapterService.debugEvaluateOperation = { name: restrictedOperation_1.WellKnownRestrictedOperations.DebugEvaluate };
exports.HostAdapterService = HostAdapterService;

//# sourceMappingURL=hostAdapterService.js.map
