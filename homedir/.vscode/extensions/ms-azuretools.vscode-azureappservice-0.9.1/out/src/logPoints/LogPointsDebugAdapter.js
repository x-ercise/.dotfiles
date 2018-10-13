"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_debugadapter_1 = require("vscode-debugadapter");
const logPointsClient_1 = require("./logPointsClient");
const logPointsDebuggerClient = logPointsClient_1.createDefaultClient();
class LogPointsDebugAdapter extends vscode_debugadapter_1.LoggingDebugSession {
    constructor() {
        super("jsLogPointsdebugadapter.log");
        // uses zero-based lines and columns
        this.setDebuggerLinesStartAt1(false);
        this.setDebuggerColumnsStartAt1(false);
    }
    initializeRequest(response, args) {
        vscode_debugadapter_1.logger.setup(vscode_debugadapter_1.Logger.LogLevel.Verbose, false);
        super.initializeRequest(response, args);
        this.sendEvent(new vscode_debugadapter_1.InitializedEvent());
    }
    attachRequest(response, args) {
        this._sessionId = args.sessionId;
        this._debugId = args.debugId;
        this._siteName = args.siteName;
        this._affinityValue = args.instanceId; // non-null behavior unknown. Should be handled by logPoints team
        this._publishingUsername = args.publishCredentialUsername;
        this._publishingPassword = args.publishCredentialPassword;
        response.body = response.body || {};
        response.body.supportsConfigurationDoneRequest = false;
        this.sendResponse(response);
    }
    setBreakPointsRequest(response, args) {
        // tslint:disable-next-line:no-unused-expression
        args && 1;
        response.body = {
            breakpoints: []
        };
        this.sendResponse(response);
    }
    threadsRequest(response) {
        // return the default thread
        response.body = {
            threads: [
                new vscode_debugadapter_1.Thread(1, "thread 1")
            ]
        };
        this.sendResponse(response);
        this.getLoadedScripts();
        this.sendSessionStartedEvent();
    }
    // tslint:disable-next-line:no-any
    customRequest(command, response, args) {
        if (command === 'loadSource') {
            const sourceId = args;
            const request = { sessionId: this._sessionId, debugId: this._debugId, sourceId };
            logPointsDebuggerClient.loadSource(this._siteName, this._affinityValue, this.getPublishCredential(), request).then((result) => {
                if (result.isSuccessful()) {
                    response.body = {
                        content: result.json.data // non-null behavior unknown. Should be handled by logPoints team
                    };
                }
                else {
                    response.body = {
                        error: result.error
                    };
                }
                this.sendResponse(response);
            });
        }
        else if (command === 'setLogpoint') {
            const request = {
                sessionId: this._sessionId, debugId: this._debugId, sourceId: args.scriptId,
                lineNumber: args.lineNumber, columNumber: args.columnNumber, expression: args.expression
            };
            logPointsDebuggerClient.setLogpoint(this._siteName, this._affinityValue, this.getPublishCredential(), request)
                .then(result => {
                if (!result.isSuccessful()) {
                    vscode_debugadapter_1.logger.error(`Cannot set logpoint. ${result.error}`);
                }
                response.body = result.json;
                this.sendResponse(response);
            });
        }
        else if (command === 'removeLogpoint') {
            const request = { sessionId: this._sessionId, debugId: this._debugId, logpointId: args };
            logPointsDebuggerClient.removeLogpoint(this._siteName, this._affinityValue, this.getPublishCredential(), request)
                .then(result => {
                vscode_debugadapter_1.logger.log(`removeLogpoint completed. ${require('util').inspect(result)}`);
                response.body = result.json;
                this.sendResponse(response);
            });
        }
        else if (command === 'getLogpoints') {
            const request = { sessionId: this._sessionId, debugId: this._debugId, sourceId: args };
            logPointsDebuggerClient.getLogpoints(this._siteName, this._affinityValue, this.getPublishCredential(), request)
                .then(result => {
                if (result.isSuccessful()) {
                    response.body = result.json;
                }
                else {
                    response.body = {
                        error: result.error
                    };
                }
                this.sendResponse(response);
            });
        }
        else if (command === 'getDebugAdapterMetadata') {
            response.body = {
                siteName: this._siteName,
                publishCredentialUsername: this._publishingUsername,
                publishCredentialPassword: this._publishingPassword,
                instanceId: this._affinityValue,
                sessionId: this._sessionId,
                debugId: this._debugId
            };
            this.sendResponse(response);
        }
        else if (command === 'terminate') {
            this.sendResponse(response);
            this.sendEvent(new vscode_debugadapter_1.TerminatedEvent());
        }
    }
    disconnectRequest(response, args) {
        // There is args.terminateDebuggee, which can be potentially utilized. Ignore for now.
        // tslint:disable-next-line:no-unused-expression
        args && 1;
        const finish = () => {
            // Since the response is just a acknowledgement, the client will not even look at it, so we call sendResponse() regardlesss of the result.
            this.sendResponse(response);
        };
        const request = { sessionId: this._sessionId };
        logPointsDebuggerClient.closeSession(this._siteName, this._affinityValue, this.getPublishCredential(), request)
            .then(finish, finish);
    }
    getLoadedScripts() {
        return __awaiter(this, void 0, void 0, function* () {
            const request = { sessionId: this._sessionId, debugId: this._debugId };
            const response = yield logPointsDebuggerClient.loadedScripts(this._siteName, this._affinityValue, this.getPublishCredential(), request);
            if (response.isSuccessful()) {
                response.json.data.forEach((sourceData) => {
                    const source = new vscode_debugadapter_1.Source(sourceData.name, sourceData.path);
                    try {
                        source.sourceReference = parseInt(sourceData.sourceId, 10);
                    }
                    catch (error) {
                        // if parseInt is not sucessful, then do not set the 'sourceReference' field.
                    }
                    this.sendEvent(new vscode_debugadapter_1.Event('loadedSource', source));
                });
            }
        });
    }
    sendSessionStartedEvent() {
        this.sendEvent(new vscode_debugadapter_1.Event('sessionStarted'));
    }
    getPublishCredential() {
        return {
            publishingUserName: this._publishingUsername,
            publishingPassword: this._publishingPassword
        };
    }
}
exports.LogPointsDebugAdapter = LogPointsDebugAdapter;
vscode_debugadapter_1.DebugSession.run(LogPointsDebugAdapter);
//# sourceMappingURL=LogPointsDebugAdapter.js.map