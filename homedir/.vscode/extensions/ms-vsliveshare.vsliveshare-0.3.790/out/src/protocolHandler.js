'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const vscode = require("vscode");
const telemetry_1 = require("./telemetry/telemetry");
const telemetryStrings_1 = require("./telemetry/telemetryStrings");
const config = require("./config");
const util_1 = require("./util");
class VSLSProtocolHandler {
    constructor(telemetryEvent) {
        this.telemetryEvent = telemetryEvent;
        if (typeof vscode_1.window.registerUriHandler === 'function') {
            util_1.ExtensionUtil.Context.subscriptions.push(vscode_1.window.registerUriHandler(this));
        }
    }
    handleUri(uri) {
        switch (uri.path) {
            case '/join': {
                this.join(uri);
                break;
            }
            default: {
                break;
            }
        }
    }
    join(uri) {
        const workspaceId = uri.query;
        const privacySafeUri = uri.with({ query: '' });
        this.reportInvocationToTelemetry(privacySafeUri);
        if (workspaceId) {
            vscode.commands.executeCommand(`${config.get(config.Key.commandPrefix)}.join`, `${config.get(config.Key.scheme)}:?action=join&workspaceId=${workspaceId}`);
        }
    }
    reportInvocationToTelemetry(uri) {
        const telemetryEvent = new telemetry_1.TelemetryEvent(telemetryStrings_1.TelemetryEventNames.INVOKE_NEWPROTOCOLHANDLER)
            .addProperty(telemetryStrings_1.TelemetryPropertyNames.URI, uri.toString())
            .correlateWith(this.telemetryEvent)
            .send();
    }
    dispose() { }
}
exports.VSLSProtocolHandler = VSLSProtocolHandler;

//# sourceMappingURL=protocolHandler.js.map
