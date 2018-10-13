//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const config = require("../config");
const util = require("../util");
const vsls = require("../contracts/VSLS");
const traceSource_1 = require("../tracing/traceSource");
const telemetry_1 = require("../telemetry/telemetry");
const telemetryStrings_1 = require("../telemetry/telemetryStrings");
const terminalController_1 = require("./terminalController");
const tt = require("./terminalTypes");
const session_1 = require("../session");
const restrictedOperation_1 = require("../accessControl/restrictedOperation");
/**
 * Orchestrates shared terminals behavior in a shared collaboration session.
 * Registers and handles UI commands.
 */
class HostTerminalController extends terminalController_1.TerminalControllerBase {
    constructor(terminalService, notificationUtil, workspaceAccessControlManager) {
        super(terminalService, traceSource_1.traceSource.withName('HostTerminalController'));
        this.notificationUtil = notificationUtil;
        this.workspaceAccessControlManager = workspaceAccessControlManager;
        if (config.get(config.Key.autoShareTerminals) &&
            vscode.window.onDidOpenTerminal) {
            vscode.window.onDidOpenTerminal(this.createIdleDataListener, this, this.globalSubscriptions);
            this.deferredWork = this.deferredWork
                .then(() => new Promise(resolve => {
                vscode.window.terminals.forEach(this.createIdleDataListener, this);
                resolve();
            }))
                .catch(reason => {
                this.trace.error(reason.message);
            });
        }
    }
    async enable() {
        if (this.isEnabled) {
            return true;
        }
        await super.enable();
        // register UI command handlers
        this.sessionSubscriptions.push(util.ExtensionUtil.registerCommand('liveshare.shareTerminal', this.shareTerminal, this), util.ExtensionUtil.registerCommand('liveshare.shareTerminalFromFileTreeExplorer', this.shareTerminal, this), util.ExtensionUtil.registerCommand('liveshare.shareTerminalFromActivityBar', this.shareTerminal, this), util.ExtensionUtil.registerCommand('liveshare.openTerminalFromFileTreeExplorer', this.openTerminal, this), util.ExtensionUtil.registerCommand('liveshare.openTerminalFromActivityBar', this.openTerminal, this), util.ExtensionUtil.registerCommand('liveshare.removeTerminalFromFileTreeExplorer', this.closeTerminal, this), util.ExtensionUtil.registerCommand('liveshare.removeTerminalFromActivityBar', this.closeTerminal, this), util.ExtensionUtil.registerCommand('liveshare.makeTerminalReadOnlyFromFileTreeExplorer', this.makeTerminalReadOnly, this), util.ExtensionUtil.registerCommand('liveshare.makeTerminalReadOnlyFromActivityBar', this.makeTerminalReadOnly, this), util.ExtensionUtil.registerCommand('liveshare.makeTerminalReadWriteFromFileTreeExplorer', this.makeTerminalReadWrite, this), util.ExtensionUtil.registerCommand('liveshare.makeTerminalReadWriteFromActivityBar', this.makeTerminalReadWrite, this));
        // enable auto-share terminals
        if (config.get(config.Key.autoShareTerminals) &&
            vscode.window.onDidOpenTerminal) {
            vscode.window.onDidOpenTerminal(async (terminal) => {
                if (!tt.isTaskTerminal(terminal) &&
                    !tt.isSharedTerminal(terminal)) {
                    await this.terminalProvider.shareTerminal(terminal);
                }
            }, this, this.sessionSubscriptions);
            this.deferredWork = this.deferredWork
                .then(async () => {
                await Promise.all(vscode.window.terminals
                    .filter(x => !tt.isTaskTerminal(x) && !tt.isSharedTerminal(x))
                    .map(x => this.terminalProvider.shareTerminal(x)));
            })
                .catch(reason => {
                this.trace.error(reason.message);
            });
        }
        return true;
    }
    async requestReadWriteAccessForTerminal(terminalId, sessionId) {
        const terminal = (await this.terminalService.getRunningTerminalsAsync()).find(t => t.id === terminalId);
        const participant = session_1.SessionContext.collaboratorManager.getCollaborators()[sessionId.toString(10)];
        if (!terminal || !participant) {
            return;
        }
        const allow = 'Make the terminal read/write for everyone';
        const reject = 'Keep it read-only';
        const response = await this.notificationUtil.showInformationMessage(`${participant.name} requested permission to write to the '${terminal.options.name}' terminal`, { modal: false }, allow, reject);
        if (response === allow) {
            await this.setTerminalReadOnly(terminalId, false);
            return undefined;
        }
        return response === reject ? false : undefined;
    }
    async closeTerminal(terminalPayload) {
        const terminals = await this.terminalService.getRunningTerminalsAsync();
        for (const terminalInfo of terminals.filter(t => t.id === terminalPayload.terminalId)) {
            await this.terminalService.stopTerminalAsync(terminalInfo.id);
            break;
        }
    }
    makeTerminalReadOnly(terminalPayload) {
        return this.setTerminalReadOnly(terminalPayload.terminalId, true /* isReadOnly */);
    }
    async makeTerminalReadWrite(terminalPayload) {
        return this.setTerminalReadOnly(terminalPayload.terminalId, false /* isReadOnly */);
    }
    async setTerminalReadOnly(terminalId, isReadOnly) {
        const terminals = await this.terminalService.getRunningTerminalsAsync();
        for (const terminalInfo of terminals.filter(t => t.id === terminalId)) {
            await this.terminalService.setTerminalReadOnlyForGuestsAsync(terminalInfo.id, isReadOnly);
            await this.workspaceAccessControlManager().setOperationAccess({ name: restrictedOperation_1.WellKnownRestrictedOperations.WriteToSharedTerminal, terminalId }, isReadOnly ? vsls.RestrictedOperationAccess.DisabledByHostConfiguration : vsls.RestrictedOperationAccess.Allowed);
            break;
        }
    }
    /**
     * Implements "Share Terminal" UI command. Creates a new terminal window and starts sharing it.
     *
     * @param origin Indicates a method the command is invoked.
     */
    async shareTerminal(origin) {
        try {
            HostTerminalController.throwIfSharedTerminalsNotEnabled();
            // In read-only session the shared terminal is always read-only.
            // In regular session, query the host if they want it read-write or read-only.
            let guestsCanWriteChoice = 'Read-only';
            if (!session_1.SessionContext.IsReadOnly) {
                guestsCanWriteChoice = await vscode.window.showQuickPick(['Read-only', 'Read/write'], { placeHolder: 'Select the access level guests should have for this terminal' });
                if (guestsCanWriteChoice === undefined) {
                    return;
                }
            }
            const cfg = vscode.workspace.getConfiguration();
            const configShellProperty = `terminal.integrated.shell.${util.getPlatformProperty()}`;
            const configShell = cfg.get(configShellProperty);
            if (!configShell) {
                throw new Error(`Terminal shell configuration property "${configShellProperty}" is empty`);
            }
            const shellBasename = path.basename(configShell).toLowerCase();
            // Use 'ps' to shorten the terminal name for powershell. The terminal name lengh is limited by the terminal drop down width in VSCode.
            const name = `${shellBasename === 'powershell.exe' ? 'ps' : path.basename(shellBasename, path.extname(shellBasename))} [Shared]`;
            // If terminal renderer is supported, spin it to get the dimensions
            let renderer = null;
            let dimensions;
            if (vscode.window.createTerminalRenderer) {
                renderer = vscode.window.createTerminalRenderer(name);
                const dimensionsPromise = new Promise((resolve) => {
                    const eventRegistration = renderer.onDidChangeMaximumDimensions(e => {
                        eventRegistration.dispose();
                        resolve(e);
                    });
                });
                // tslint:disable-next-line:no-shadowed-variable
                const terminal = await renderer.terminal;
                await terminal.show();
                dimensions = await dimensionsPromise;
            }
            else {
                dimensions = {
                    columns: config.get(config.Key.sharedTerminalWidth),
                    rows: config.get(config.Key.sharedTerminalWidth)
                };
            }
            const configArgs = cfg.get(`terminal.integrated.shellArgs.${util.getPlatformProperty()}`) || [];
            const configEnv = cfg.get(`terminal.integrated.env.${util.getPlatformProperty()}`);
            const readOnlyForGuests = guestsCanWriteChoice === 'Read-only';
            let options = {
                name,
                rows: dimensions.rows,
                cols: dimensions.columns,
                cwd: cfg.get('terminal.integrated.cwd') || util.PathUtil.getPrimaryWorkspaceFileSystemPath(),
                app: configShell,
                commandLine: configArgs,
                environment: configEnv,
                readOnlyForGuests,
            };
            const terminalInfo = await this.terminalService.startTerminalAsync(options);
            await this.terminalProvider.createTerminal(terminalInfo, renderer);
            telemetry_1.Instance.sendTelemetryEvent(telemetryStrings_1.TelemetryEventNames.START_SHARED_TERMINAL, {
                [telemetryStrings_1.TelemetryPropertyNames.SHARED_TERMINAL_SHELL]: path.parse(configShell).name,
                [telemetryStrings_1.TelemetryPropertyNames.SHARED_TERMINAL_READONLY]: readOnlyForGuests.toString(),
            });
        }
        catch (e) {
            telemetry_1.Instance.sendFault(telemetryStrings_1.TelemetryEventNames.START_SHARED_TERMINAL_FAULT, telemetry_1.FaultType.Error, null, e);
            throw e;
        }
    }
    static throwIfSharedTerminalsNotEnabled() {
        if (!config.featureFlags.sharedTerminals) {
            throw new Error('Shared terminal feature is not enabled');
        }
    }
    /**
     * Starts observing terminal output and extracting metadata from written data.
     * Updates shared terminal cache when altering terminal property values.
     */
    createIdleDataListener(terminal) {
        if (tt.isTaskTerminal(terminal) || tt.isSharedTerminal(terminal)) {
            return;
        }
        const terminalEntry = this.terminalCache.register(terminal);
        let registrations = [];
        terminal.onDidWriteData((s) => {
            const from = s.lastIndexOf('\r');
            if (from !== -1) {
                // set new prompt
                terminalEntry.update(tt.MetadataKey.prompt, s.substr(from));
            }
            else {
                // append this data block to the current prompt
                const current = terminalEntry.get(tt.MetadataKey.prompt) || '';
                terminalEntry.update(tt.MetadataKey.prompt, current.concat(s));
            }
        }, null /* this */, registrations);
        terminalEntry.workers.push({
            dispose: () => {
                registrations.forEach(d => d.dispose());
            },
            scope: tt.WorkerScope.global,
        });
    }
}
exports.HostTerminalController = HostTerminalController;

//# sourceMappingURL=hostTerminalController.js.map
