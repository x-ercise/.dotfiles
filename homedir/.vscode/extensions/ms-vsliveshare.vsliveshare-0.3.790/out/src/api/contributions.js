"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const util_1 = require("../util");
const telemetry_1 = require("../telemetry/telemetry");
const telemetryStrings_1 = require("../telemetry/telemetryStrings");
/**
 * Tracks and coordinates contributions from extensions that integrate in some way with
 * the Live Share user experience. For now that is just commands, but may eventually
 * include other envisioned contributions like user status, "resources", and more.
 */
class ExtensionContributions {
    constructor(packageInfo, trace) {
        this.packageInfo = packageInfo;
        this.trace = trace;
        this.commands = new Map();
    }
    static getContributions(packageInfo, trace) {
        let contributions = ExtensionContributions.map.get(packageInfo.fullName);
        if (!contributions) {
            contributions = new ExtensionContributions(packageInfo, trace);
            ExtensionContributions.map.set(packageInfo.fullName, contributions);
        }
        return contributions;
    }
    registerCommand(command, isEnabled, thisArg) {
        // Load command strings from the calling extension's package.json.
        const packageContributes = this.packageInfo.contributes;
        if (!packageContributes || !packageContributes.commands ||
            !packageContributes.commands.find(c => c.command === command)) {
            this.trace.warning('Command not declared in extension manifest: ' + command);
            return;
        }
        const commandInfo = packageContributes.commands.find(c => c.command === command);
        if (!commandInfo['vsls-label'] || !commandInfo['vsls-detail']) {
            this.trace.warning('Missing VSLS extended properties in extension manifest ' +
                'for command: ' + command);
            return;
        }
        // Insert a level of indirection to enable tracing and telemetry.
        const extensionCommandId = '_liveshare.extensionCommand';
        if (!ExtensionContributions.extensionCommandRegistered) {
            util_1.ExtensionUtil.registerCommand(extensionCommandId, (context) => context.thisArg.invokeExtensionCommand(context.command));
            ExtensionContributions.extensionCommandRegistered = true;
        }
        this.commands.set(command, {
            command: extensionCommandId,
            commandArg: { command, thisArg: this },
            label: commandInfo['vsls-label'],
            detail: commandInfo['vsls-detail'],
            enabled: isEnabled && isEnabled.bind(thisArg),
            description: '',
        });
        return {
            dispose: () => {
                this.commands.delete(command);
            }
        };
    }
    async invokeExtensionCommand(command) {
        this.trace.verbose(`invoke(${command})`);
        this.sendInvokeCommandTelemetryEvent(command);
        return await vscode.commands.executeCommand(command);
    }
    /**
     * Gets all the quick-pick items registered by all extensions via our
     * extensibility API. Called by the statusbar controller before showing
     * the Live Share contextual command palette.
     */
    static getQuickPickItems() {
        const items = [];
        for (let [id, contributions] of this.map) {
            for (let [command, item] of contributions.commands) {
                items.push(item);
            }
        }
        return items;
    }
    sendInvokeCommandTelemetryEvent(commandName) {
        telemetry_1.Instance.sendTelemetryEvent(telemetryStrings_1.TelemetryEventNames.INVOKE_EXTENSION_COMMAND, {
            [telemetryStrings_1.TelemetryPropertyNames.EXTENSION_NAME]: this.packageInfo.fullName,
            [telemetryStrings_1.TelemetryPropertyNames.EXTENSION_VERSION]: this.packageInfo.version,
            [telemetryStrings_1.TelemetryPropertyNames.EXTENSION_INVOKED_COMMAND]: commandName,
        });
    }
}
ExtensionContributions.map = new Map();
ExtensionContributions.extensionCommandRegistered = false;
exports.ExtensionContributions = ExtensionContributions;

//# sourceMappingURL=contributions.js.map
