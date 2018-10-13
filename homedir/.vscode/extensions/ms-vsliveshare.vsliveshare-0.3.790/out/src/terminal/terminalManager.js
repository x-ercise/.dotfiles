//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const session_1 = require("../session");
const sessionTypes_1 = require("../sessionTypes");
const hostTerminalController_1 = require("./hostTerminalController");
const guestTerminalController_1 = require("./guestTerminalController");
/**
 * Orchestrates terminal controllers in shared and joined collaboration sessions.
 */
class TerminalManager {
    constructor(terminalService, notificationUtil, workspaceAccessControlManager, accessControlManager) {
        this.terminalService = terminalService;
        this.notificationUtil = notificationUtil;
        this.accessControlManager = accessControlManager;
        // Instantiate a host controller by default.
        // It will start monitoring current terminal output for further sharing.
        this.hostController = new hostTerminalController_1.HostTerminalController(terminalService, notificationUtil, workspaceAccessControlManager);
        session_1.SessionContext.on(sessionTypes_1.SessionEvents.StateChanged, (newState, previousState) => this.handleSessionStateChanged(newState, previousState));
    }
    async dispose() {
        session_1.SessionContext.removeListener(sessionTypes_1.SessionEvents.StateChanged, this.handleSessionStateChanged);
        await this.hostController.dispose();
        if (this.guestController) {
            await this.guestController.dispose();
        }
    }
    requestReadWriteAccessForTerminal(terminalId, sessionId) {
        return this.hostController.requestReadWriteAccessForTerminal(terminalId, sessionId);
    }
    async terminalWriteAccessRejected(terminalId, isEscapeSequence) {
        return this.guestController && await this.guestController.terminalWriteAccessRejected(terminalId, isEscapeSequence);
    }
    async terminalWriteAccessChanged(terminalId, access) {
        return this.guestController && await this.guestController.terminalWriteAccessChanged(terminalId, access);
    }
    async handleSessionStateChanged(newState, previousState) {
        switch (newState) {
            case sessionTypes_1.SessionState.Shared:
                // Activate the host terminal controller in a shared collaboration session.
                await this.hostController.enable();
                break;
            case sessionTypes_1.SessionState.JoiningInProgress:
                // The host controller is not to be used in a joined collaboration session.
                // Stop background monitoring of terminal output.
                this.hostController.dispose();
                // Instantiate a guest controller.
                this.guestController = new guestTerminalController_1.GuestTerminalController(this.terminalService, this.notificationUtil, this.accessControlManager);
                break;
            case sessionTypes_1.SessionState.Joined:
                // Activate the guest terminal controller in a guest collaboration session.
                await this.guestController.enable();
                break;
            default:
                if (previousState === sessionTypes_1.SessionState.Shared) {
                    // Disengage the host controller when leaving a shared collaboration session.
                    this.hostController.disable();
                }
                if (this.guestController && previousState === sessionTypes_1.SessionState.Joined) {
                    // Disengage the guest controller when leaving a joined collaboration session.
                    this.guestController.disable();
                }
                break;
        }
    }
}
exports.TerminalManager = TerminalManager;

//# sourceMappingURL=terminalManager.js.map
