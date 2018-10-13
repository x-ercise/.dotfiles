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
const util = require("util");
const vscode = require("vscode");
const remoteScriptDocumentProvider_1 = require("./remoteScriptDocumentProvider");
const LogpointsCollection_1 = require("./structs/LogpointsCollection");
const extensionVariables_1 = require("../extensionVariables");
class DebugSessionManager {
    constructor(_debugSession) {
        this._debugSession = _debugSession;
        this._logpointsCollectionMapping = {};
    }
    registerLogpoint(documentUri, logpoint) {
        const logpointsCollection = this.getLogpointCollectionForDocument(documentUri);
        logpointsCollection.registerLogpoint(logpoint);
        logpointsCollection.updateTextEditorDecroration();
    }
    unregisterLogpoint(documentUri, logpoint) {
        const logpointsCollection = this.getLogpointCollectionForDocument(documentUri);
        logpointsCollection.unregisterLogpoint(logpoint);
        logpointsCollection.updateTextEditorDecroration();
    }
    getLogpointAtLocation(documentUri, lineNumber) {
        const uriString = documentUri.toString();
        if (!this._logpointsCollectionMapping[uriString]) {
            return undefined;
        }
        const logpointsCollection = this._logpointsCollectionMapping[uriString];
        return logpointsCollection.getLogpointForLine(lineNumber);
    }
    /**
     * Re-display the gutter glyphs for the document of documentUri.
     * @param documentUri the Uri of the document.
     */
    recoverLogpoints(documentUri) {
        return __awaiter(this, void 0, void 0, function* () {
            const uriString = documentUri.toString();
            let logpointsCollection = this._logpointsCollectionMapping[uriString];
            // If we have not seen any logpoints for this collection,
            // try to contact server and see if it knows about any existing logpoints.
            if (!logpointsCollection) {
                logpointsCollection = new LogpointsCollection_1.LogpointsCollection(documentUri);
                this._logpointsCollectionMapping[uriString] = logpointsCollection;
                const params = remoteScriptDocumentProvider_1.RemoteScriptSchema.extractQueryParams(documentUri);
                const result = yield this._debugSession.customRequest("getLogpoints", params.internalScriptId);
                result.data.forEach(logpoint => {
                    logpointsCollection.registerLogpoint({
                        id: logpoint.logpointId,
                        line: logpoint.actualLocation.zeroBasedLineNumber,
                        column: logpoint.actualLocation.zeroBasedColumnNumber,
                        expression: logpoint.expressionToLog
                    });
                });
            }
            logpointsCollection.updateTextEditorDecroration();
        });
    }
    removeLogpointGlyphsFromDocument(documentUri) {
        const logpointsCollection = this.getLogpointCollectionForDocument(documentUri);
        logpointsCollection.clearRegistry();
        logpointsCollection.updateTextEditorDecroration();
    }
    addLogpoint(scriptId, lineNumber, columnNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            const expression = yield vscode.window.showInputBox({
                ignoreFocusOut: true,
                placeHolder: "Eg: myVar == true ? 'yes' : otherVar",
                prompt: "Expression to be evaluated at the logpoint"
            });
            if (expression === undefined) {
                vscode.window.showErrorMessage("An expression must be provided.");
                throw new Error(`[Set Logpoint] Expression is not provided.`);
            }
            const result = yield this._debugSession.customRequest("setLogpoint", { scriptId, lineNumber, columnNumber, expression });
            if (result.error !== undefined && result.error !== null) {
                const errorMessage = result.error.message === '' ?
                    'Cannot set logpoint. Please refer to https://aka.ms/logpoints#setting-logpoints for more details.' :
                    `Cannot set logpoint, the error is "${result.error.message}". Please refer to https://aka.ms/logpoints#setting-logpoints for more details.`;
                // Send telemetry with error by throwing it.
                throw new Error(errorMessage);
            }
            const logpoint = result.data.logpoint;
            return {
                id: logpoint.logpointId, line: logpoint.actualLocation.zeroBasedLineNumber, column: logpoint.actualLocation.zeroBasedColumnNumber, expression: logpoint.expressionToLog
            };
        });
    }
    removeLogpoint(logpoint) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this._debugSession.customRequest("removeLogpoint", logpoint.id);
            if (result.error !== undefined && result.error !== null) {
                const errorMessage = result.error.message === '' ?
                    'Cannot remove logpoint. Please refer to https://aka.ms/logpoints for more details.' :
                    `Cannot remove logpoint, the error is "${result.error.message}". Please refer to https://aka.ms/logpoints for more details.`;
                throw new Error(errorMessage);
            }
        });
    }
    retrieveMetadata() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._metadata) {
                const response = yield this._debugSession.customRequest("getDebugAdapterMetadata");
                this._metadata = response;
            }
            return this._metadata;
        });
    }
    kill() {
        return __awaiter(this, void 0, void 0, function* () {
            this._debugSession.customRequest('terminate');
            return;
        });
    }
    getLogpointCollectionForDocument(documentUri) {
        const uriString = documentUri.toString();
        let logpointsCollection = this._logpointsCollectionMapping[uriString];
        if (!logpointsCollection) {
            logpointsCollection = new LogpointsCollection_1.LogpointsCollection(documentUri);
            this._logpointsCollectionMapping[uriString] = logpointsCollection;
        }
        return logpointsCollection;
    }
}
class LogPointsManager extends vscode.Disposable {
    constructor() {
        super(() => {
            this.cleanup();
        });
        this._debugSessionManagerMapping = {};
        this._siteStreamingLogOutputChannelMapping = {};
        this.initialize();
    }
    initialize() {
        // Remember the launched debug sessions, so we can find them later when needed.
        vscode.debug.onDidStartDebugSession((debugSession) => {
            const debugSessionManager = new DebugSessionManager(debugSession);
            this._debugSessionManagerMapping[debugSession.id] = debugSessionManager;
        });
        vscode.debug.onDidTerminateDebugSession((debugSession) => {
            this.onDebugSessionClose(debugSession);
            delete this._debugSessionManagerMapping[debugSession.id];
            const siteName = debugSession.name;
            if (this._siteStreamingLogOutputChannelMapping[siteName]) {
                delete this._siteStreamingLogOutputChannelMapping[siteName];
            }
        });
        vscode.window.onDidChangeActiveTextEditor((event) => {
            this.onActiveEditorChange(event);
        });
        vscode.debug.onDidReceiveDebugSessionCustomEvent((event) => {
            this.onDebugSessionCustomEvent(event);
        });
    }
    toggleLogpoint(uri) {
        return __awaiter(this, void 0, void 0, function* () {
            if (uri.scheme !== remoteScriptDocumentProvider_1.RemoteScriptSchema.schema) {
                vscode.window.showWarningMessage(util.format("Cannot set a tracepoint to this document %s. Expected schema: \"%s\", actual: \"%s\"", uri.fsPath, remoteScriptDocumentProvider_1.RemoteScriptSchema.schema, uri.scheme));
                return false;
            }
            if (!vscode.window.activeTextEditor) {
                vscode.window.showInformationMessage("Open a file first to toggle bookmarks");
                return false;
            }
            if (vscode.window.activeTextEditor.document.uri.toString() !== uri.toString()) {
                throw new Error("Invalid operation: cannot operate on an inactive text editor.");
            }
            const line = vscode.window.activeTextEditor.selection.active.line;
            const column = 0;
            const params = remoteScriptDocumentProvider_1.RemoteScriptSchema.extractQueryParams(uri);
            const debugSessionManager = this._debugSessionManagerMapping[params.vscodeDebugSessionId];
            if (!debugSessionManager) {
                vscode.window.showErrorMessage(`The debug session associated with this file has expired. Please close this file and open it again from LOADED SCRIPTS explorer of an active logpoints session. More details can be found here http://aka.ms/logpoints#setting-up-logpoints`);
                return false;
            }
            const logpoint = debugSessionManager.getLogpointAtLocation(uri, line);
            if (logpoint) {
                yield debugSessionManager.removeLogpoint(logpoint);
                debugSessionManager.unregisterLogpoint(uri, logpoint);
                extensionVariables_1.ext.outputChannel.appendLine(`Removed logpoint at line ${logpoint.line} in ${params.path}`);
            }
            else {
                const newLogpoint = yield debugSessionManager.addLogpoint(params.internalScriptId, line, column);
                debugSessionManager.registerLogpoint(uri, newLogpoint);
                extensionVariables_1.ext.outputChannel.appendLine(`Added logpoint at line ${newLogpoint.line} in ${params.path}`);
            }
            return true;
        });
    }
    onAppServiceSiteClosed(client) {
        return __awaiter(this, void 0, void 0, function* () {
            const debugSessionManager = yield this.findDebugSessionManagerBySite(client);
            if (!debugSessionManager) {
                // If there is no debugSession associated with the site, then do nothing.
                return;
            }
            yield debugSessionManager.kill();
            extensionVariables_1.ext.outputChannel.show();
            extensionVariables_1.ext.outputChannel.appendLine("The logpoints session has terminated because the App Service is stopped or restarted.");
        });
    }
    onStreamingLogOutputChannelCreated(client, outputChannel) {
        this._siteStreamingLogOutputChannelMapping[client.fullName] = outputChannel;
    }
    onActiveEditorChange(activeEditor) {
        if (!activeEditor) {
            return;
        }
        const documentUri = activeEditor.document.uri;
        if (documentUri.scheme !== remoteScriptDocumentProvider_1.RemoteScriptSchema.schema) {
            return;
        }
        const params = remoteScriptDocumentProvider_1.RemoteScriptSchema.extractQueryParams(documentUri);
        const debugSessionManager = this._debugSessionManagerMapping[params.vscodeDebugSessionId];
        if (!debugSessionManager) {
            // If debugSessionManager does not exist, it might be closed. This can happen when user
            // switch to a document that was opened during the debug session before.
            return;
        }
        debugSessionManager.recoverLogpoints(documentUri);
    }
    onDebugSessionClose(debugSession) {
        const debugSessionManager = this._debugSessionManagerMapping[debugSession.id];
        if (!debugSessionManager) {
            // If debugSessionManager does not exist, it might have been handled already.
            return;
        }
        if (!vscode.window.activeTextEditor) {
            return;
        }
        const documentUri = vscode.window.activeTextEditor.document.uri;
        debugSessionManager.removeLogpointGlyphsFromDocument(documentUri);
    }
    onDebugSessionCustomEvent(e) {
        if (e.event === 'sessionStarted') {
            const siteName = e.session.name;
            const streamingLogOutputChannel = this._siteStreamingLogOutputChannelMapping[siteName];
            if (streamingLogOutputChannel) {
                streamingLogOutputChannel.show();
            }
            else {
                extensionVariables_1.ext.outputChannel.show();
                extensionVariables_1.ext.outputChannel.appendLine('Cannot find streaming log output channel.');
            }
        }
    }
    findDebugSessionManagerBySite(client) {
        return __awaiter(this, void 0, void 0, function* () {
            let matchedDebugSessionManager;
            const debugSessionManagers = Object.keys(this._debugSessionManagerMapping).map((key) => { return this._debugSessionManagerMapping[key]; });
            for (const debugSessionManager of debugSessionManagers) {
                const debugSessionMetadata = yield debugSessionManager.retrieveMetadata();
                if (client.fullName === debugSessionMetadata.siteName) {
                    matchedDebugSessionManager = debugSessionManager;
                    break;
                }
            }
            return matchedDebugSessionManager;
        });
    }
    // tslint:disable-next-line:no-empty
    cleanup() {
    }
}
exports.LogPointsManager = LogPointsManager;
//# sourceMappingURL=LogPointsManager.js.map