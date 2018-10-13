//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const session_1 = require("../session");
const terminalProvider_1 = require("./terminalProvider");
const tt = require("./terminalTypes");
/**
 * Shared implementation for terminal controllers.
 */
class TerminalControllerBase {
    constructor(terminalService, trace) {
        this.terminalService = terminalService;
        this.trace = trace;
        this.terminalCache = new tt.TerminalCache();
        this.sessionSubscriptions = [];
        this.globalSubscriptions = [];
        this.deferredWork = Promise.resolve();
        this.terminalProvider = new terminalProvider_1.TerminalProvider(terminalService, this.terminalCache, this.trace);
        vscode.window.onDidCloseTerminal((terminal) => {
            this.terminalCache.remove(terminal);
        }, null /* this */, this.globalSubscriptions);
    }
    async dispose() {
        await this.deferredWork;
        this.disable();
        const removed = this.globalSubscriptions.splice(0);
        removed.forEach(d => d.dispose());
        this.terminalCache.clean();
        session_1.SessionContext.HasSharedTerminals = false;
    }
    enable() {
        this.isEnabled = true;
        return Promise.resolve(true);
    }
    disable() {
        const removed = this.sessionSubscriptions.splice(0);
        removed.forEach(d => d.dispose());
        this.terminalCache.clean(true /* sessionOnly */);
        this.isEnabled = false;
    }
    async openTerminal(terminalPayload) {
        const terminals = await this.terminalService.getRunningTerminalsAsync();
        for (const terminalInfo of terminals.filter(t => t.id === terminalPayload.terminalId)) {
            await this.terminalProvider.createTerminal(terminalInfo);
            break;
        }
    }
}
exports.TerminalControllerBase = TerminalControllerBase;

//# sourceMappingURL=terminalController.js.map
