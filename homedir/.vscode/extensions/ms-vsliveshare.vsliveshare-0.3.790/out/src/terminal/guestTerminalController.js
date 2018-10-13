//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const util = require("../util");
const vsls = require("../contracts/VSLS");
const session_1 = require("../session");
const traceSource_1 = require("../tracing/traceSource");
const terminalController_1 = require("./terminalController");
const sessionTypes_1 = require("../sessionTypes");
const restrictedOperation_1 = require("../accessControl/restrictedOperation");
/**
 * Orchestrates shared terminals behavior in a joined collaboration session.
 * Registers and handles UI commands.
 */
class GuestTerminalController extends terminalController_1.TerminalControllerBase {
    constructor(terminalService, notificationUtil, accessControlManager) {
        super(terminalService, traceSource_1.traceSource.withName('GuestTerminalController'));
        this.notificationUtil = notificationUtil;
        this.accessControlManager = accessControlManager;
        this.terminalsAwaitingWriteAccess = new Set();
        this.terminalsWithRejectedWriteAccess = new Set();
    }
    async enable() {
        if (this.isEnabled) {
            return true;
        }
        await super.enable();
        // register UI command handlers
        this.sessionSubscriptions.push(this.terminalService.onTerminalStarted(this.onHostTerminalStarted, this), this.terminalService.onTerminalStopped(this.onHostTerminalStopped, this), util.ExtensionUtil.registerCommand('liveshare.listSharedTerminals', this.listSharedTerminals, this), util.ExtensionUtil.registerCommand('liveshare.openTerminalFromFileTreeExplorer', this.openTerminal, this), util.ExtensionUtil.registerCommand('liveshare.openTerminalFromActivityBar', this.openTerminal, this));
        this.deferredWork = this.deferredWork
            .then(() => this.openSharedTerminalsOnJoin())
            .catch(reason => {
            this.trace.error(reason.message);
        });
    }
    async terminalWriteAccessRejected(terminalId, isEscapeSequence) {
        if (session_1.SessionContext.State !== sessionTypes_1.SessionState.Joined || this.terminalsAwaitingWriteAccess.has(terminalId) || isEscapeSequence) {
            return;
        }
        this.terminalsAwaitingWriteAccess.add(terminalId);
        const terminal = (await this.terminalService.getRunningTerminalsAsync()).find(t => t.id === terminalId);
        if (!terminal) {
            this.terminalsAwaitingWriteAccess.delete(terminalId);
            return;
        }
        this.terminalsWithRejectedWriteAccess.delete(terminalId);
        const requestReadWrite = 'Request read/write access';
        const response = await this.notificationUtil.showInformationMessage('Cannot edit a read-only terminal.', { modal: false }, requestReadWrite);
        if (session_1.SessionContext.State !== sessionTypes_1.SessionState.Joined) {
            this.terminalsAwaitingWriteAccess.delete(terminalId);
            return;
        }
        if (response === requestReadWrite) {
            await this.accessControlManager().requestOperationAccess({
                name: restrictedOperation_1.WellKnownRestrictedOperations.WriteToSharedTerminal,
                sessionId: session_1.SessionContext.coeditingClient.clientID,
                terminalId
            });
        }
    }
    async terminalWriteAccessChanged(terminalId, access) {
        if (!this.terminalsAwaitingWriteAccess.has(terminalId)) {
            return;
        }
        if (session_1.SessionContext.State !== sessionTypes_1.SessionState.Joined) {
            this.terminalsAwaitingWriteAccess.delete(terminalId);
            return;
        }
        const allowed = access === vsls.RestrictedOperationAccess.Allowed;
        if (!allowed && this.terminalsWithRejectedWriteAccess.has(terminalId)) {
            // We have already show a message about rejected. It must be some other participant requesting access to the terminal.
            return;
        }
        const terminal = (await this.terminalService.getRunningTerminalsAsync()).find(t => t.id === terminalId);
        if (!terminal || session_1.SessionContext.State !== sessionTypes_1.SessionState.Joined) {
            this.terminalsAwaitingWriteAccess.delete(terminalId);
            this.terminalsWithRejectedWriteAccess.delete(terminalId);
            return;
        }
        if (allowed) {
            this.terminalsAwaitingWriteAccess.delete(terminalId);
            this.terminalsWithRejectedWriteAccess.delete(terminalId);
        }
        else {
            this.terminalsWithRejectedWriteAccess.add(terminalId);
        }
        const focusTerminal = 'Focus terminal';
        const responses = allowed ? [focusTerminal] : [];
        const response = await this.notificationUtil.showInformationMessage(`The host ${allowed ? 'allowed' : 'didn\'t allow'} read/write access to '${terminal.options.name}' terminal.`, { modal: false }, ...responses);
        if (response === focusTerminal && session_1.SessionContext.State === sessionTypes_1.SessionState.Joined) {
            await this.openTerminal({ terminalId });
        }
    }
    async openSharedTerminalsOnJoin() {
        try {
            const terminals = await this.updateSessionContext();
            await Promise.all(terminals.map(value => this.terminalProvider.createTerminal(value)));
        }
        catch (_a) {
            session_1.SessionContext.HasSharedTerminals = false;
        }
    }
    /**
     * Implements "Access Shared Terminal" UI command
     */
    async listSharedTerminals() {
        const terminals = await this.getRunningTerminalsAsync();
        if (terminals.length === 0) {
            await vscode.window.showInformationMessage('No terminals are currently shared in the collaboration session.', { modal: false });
            return;
        }
        let index = -1;
        if (terminals.length === 1) {
            index = 0;
        }
        else {
            const items = terminals.map((t, i) => `${i + 1}: ${t.options.name}`);
            const selection = await vscode.window.showQuickPick(items, { placeHolder: 'Select shared terminal to open' });
            if (!selection) {
                return;
            }
            index = items.indexOf(selection);
        }
        if (index >= 0) {
            await this.terminalProvider.createTerminal(terminals[index]);
        }
    }
    async onHostTerminalStarted(event) {
        await this.updateSessionContext();
        await this.terminalProvider.createTerminal(event.terminal);
    }
    async onHostTerminalStopped() {
        await this.updateSessionContext();
    }
    async updateSessionContext() {
        try {
            const terminals = await this.getRunningTerminalsAsync();
            session_1.SessionContext.HasSharedTerminals = terminals.length > 0;
            return terminals;
        }
        catch (e) {
            this.trace.error('Checking for shared terminals failed: ' + e);
        }
    }
    async getRunningTerminalsAsync() {
        try {
            return await this.terminalService.getRunningTerminalsAsync();
        }
        catch (e) {
            if (e.code === -32601) {
                // Other side doesn't have terminal service
                return [];
            }
            throw e;
        }
    }
}
exports.GuestTerminalController = GuestTerminalController;

//# sourceMappingURL=guestTerminalController.js.map
