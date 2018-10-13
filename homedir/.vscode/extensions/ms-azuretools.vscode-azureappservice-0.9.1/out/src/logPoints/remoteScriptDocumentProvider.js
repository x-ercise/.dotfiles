"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
var RemoteScriptSchema;
(function (RemoteScriptSchema) {
    RemoteScriptSchema.schema = "remote-script";
    function extractQueryParams(uri) {
        const paramPairs = uri.query.split("&");
        return paramPairs.reduce((collect, paramPair) => {
            const parts = paramPair.split('=');
            collect[parts[0]] = parts[1];
            return collect;
        }, {});
    }
    RemoteScriptSchema.extractQueryParams = extractQueryParams;
    function create(debugSession, script) {
        let scriptPath = script.path;
        if (script.name === script.path) {
            scriptPath = `/native/${script.name}`;
        }
        return vscode.Uri.parse(`${RemoteScriptSchema.schema}://${scriptPath}?vscodeDebugSessionId=${debugSession.id}&path=${script.path}&internalScriptId=${script.sourceReference}`);
    }
    RemoteScriptSchema.create = create;
})(RemoteScriptSchema = exports.RemoteScriptSchema || (exports.RemoteScriptSchema = {}));
class RemoteScriptDocumentProvider {
    constructor() {
        this._debugSessionMapping = {};
        // tslint:disable-next-line:member-ordering
        this._onDidChange = new vscode.EventEmitter();
        // tslint:disable-next-line:member-ordering
        this.onDidChange = this._onDidChange.event;
        this.initialize();
    }
    provideTextDocumentContent(uri, token) {
        // tslint:disable-next-line:no-unused-expression
        token && 1;
        const params = RemoteScriptSchema.extractQueryParams(uri);
        const debugSession = this._debugSessionMapping[params.vscodeDebugSessionId];
        if (!debugSession) {
            const error = `Cannot find debug session ${params.vscodeDebugSessionId}`;
            vscode.window.showErrorMessage(error);
            return Promise.reject(error);
        }
        return debugSession.customRequest("loadSource", params.internalScriptId).then((result) => {
            return result.content;
        });
    }
    initialize() {
        // Remember the launched debug sessions, so we can find them later when needed.
        vscode.debug.onDidStartDebugSession((debugSession) => {
            this._debugSessionMapping[debugSession.id] = debugSession;
        });
        vscode.debug.onDidTerminateDebugSession((debugSession) => {
            delete this._debugSessionMapping[debugSession.id];
        });
    }
}
exports.RemoteScriptDocumentProvider = RemoteScriptDocumentProvider;
//# sourceMappingURL=remoteScriptDocumentProvider.js.map