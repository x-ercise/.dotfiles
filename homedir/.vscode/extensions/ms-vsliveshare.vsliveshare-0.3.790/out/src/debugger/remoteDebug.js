"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_debugadapter_1 = require("vscode-debugadapter");
class RemoteDebugSession extends vscode_debugadapter_1.DebugSession {
    initializeRequest(response, args) {
        // build and return the capabilities of this debug adapter:
        response.body = response.body || {};
        response.body.supportsConfigurationDoneRequest = false;
        this.sendResponse(response);
        this.sendEvent(new vscode_debugadapter_1.InitializedEvent());
    }
    launchRequest(response, args) {
        this.sendResponse(response);
        this.sendEvent(new vscode_debugadapter_1.TerminatedEvent());
    }
}
RemoteDebugSession.typeRemoteJoin = 'vslsRemoteJoin';
exports.RemoteDebugSession = RemoteDebugSession;

//# sourceMappingURL=remoteDebug.js.map
