"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
const vscode = require("vscode");
const vsls = require("../contracts/VSLS");
const util_1 = require("../util");
const session_1 = require("../session");
const sessionTypes_1 = require("../sessionTypes");
const config = require("../config");
const semaphore_async_await_1 = require("semaphore-async-await");
const restrictedOperation_1 = require("./restrictedOperation");
const clientAccessCheck_1 = require("./clientAccessCheck");
const traceSource_1 = require("../tracing/traceSource");
const telemetry_1 = require("../telemetry/telemetry");
const telemetryStrings_1 = require("../telemetry/telemetryStrings");
class WorkspaceAccessControlManager extends clientAccessCheck_1.ClientAccessCheck {
    constructor(workspaceAccessControlService, workspaceUserService, terminalManager) {
        super(workspaceAccessControlService);
        this.workspaceUserService = workspaceUserService;
        this.terminalManager = terminalManager;
        this.guestNameSemaphore = new semaphore_async_await_1.default(1);
        this.guestNameCounts = new Map();
    }
    get isReadOnly() {
        return false; // Host is never read-only.
    }
    endCollaboration() {
        this.guestNameCounts.clear();
        super.endCollaboration();
    }
    async setReadOnly(isReadOnly) {
        let workspaceAccessControl = await this.workspaceAccessControlService.getAccessControlAsync() || {};
        workspaceAccessControl.defaultAccessControl = workspaceAccessControl.defaultAccessControl || {};
        if (!!workspaceAccessControl.defaultAccessControl.isReadOnly !== isReadOnly) {
            if (session_1.SessionContext.HasCollaborators) {
                await vscode.window.showErrorMessage('Cannot change read-only status of the collaboration session when there are participants joined.', { modal: util_1.ExtensionUtil.enableModalNotifications });
                return;
            }
            workspaceAccessControl.defaultAccessControl.isReadOnly = isReadOnly;
            // Set session context here sooner, don't wait for the event to set it up.
            session_1.SessionContext.IsReadOnly = isReadOnly;
            await this.workspaceAccessControlService.setAccessControlAsync(workspaceAccessControl);
        }
    }
    async setOperationAccess(operation, access) {
        await this.workspaceAccessControlService.setOperationAccessAsync(operation, access);
    }
    async onWorkspaceSessionChanged(e) {
        if (e.changeType === vsls.WorkspaceSessionChangeType.Joined && session_1.SessionContext.State === sessionTypes_1.SessionState.Shared) {
            const sessionNumber = e.sessionNumber;
            const approval = await this.approveGuest(sessionNumber, e);
            if (typeof approval === 'boolean') {
                await this.workspaceUserService.acceptOrRejectGuestAsync(sessionNumber, approval);
            }
            else {
                await this.workspaceUserService.rejectGuestAsync(sessionNumber, approval.errorCode || vsls.ErrorCodes.CollaborationSessionGuestRejectedWithSpecificReason, approval.errorMessage);
            }
        }
        if (e.changeType === vsls.WorkspaceSessionChangeType.Unjoined && session_1.SessionContext.State === sessionTypes_1.SessionState.Shared) {
            await this.showGuestLeftNotification(e);
        }
    }
    async approveGuest(sessionNumber, e) {
        const guestCapabilities = e.userProfile.clientCapabilities || {};
        if (session_1.SessionContext.IsReadOnly && (!guestCapabilities.extensionReadOnlySupport || !guestCapabilities.clientReadOnlySupport)) {
            // In read-only mode reject guests who do not support it.
            if (!guestCapabilities.extensionReadOnlySupport && !guestCapabilities.clientReadOnlySupport) {
                return { errorMessage: 'Your VS Live Share extension does not support read-only collaboration session. Please update the extension.' };
            }
            if (!guestCapabilities.clientReadOnlySupport) {
                const appName = e.applicationName === 'VisualStudio' ? 'Visual Studio' :
                    e.applicationName === 'VSCode' ? 'VS Code' :
                        undefined;
                return { errorMessage: `Your ${appName || 'client'} does not support read-only collaboration session. Please update ${appName || 'the client'}.` };
            }
            return { errorMessage: 'Read-only support is disabled. To join a read-only collaboration session, please enable the read-only support feature.' };
        }
        if (!config.featureFlags.guestApproval) {
            return true;
        }
        const guestDisplayName = await this.getGuestDisplayName(e.userProfile);
        if (config.get(config.Key.guestApprovalRequired)) {
            return await this.waitForHostToAcceptGuest(sessionNumber, guestDisplayName);
        }
        // Do not await on the notification to allow guest to join right away
        // The host can later kick them off
        this.showJoinNotification(sessionNumber, guestDisplayName);
        return true;
    }
    async waitForHostToAcceptGuest(sessionNumber, guestDisplayName) {
        await this.workspaceUserService.fireProgressUpdatedToGuestAsync(vsls.WorkspaceProgress.WaitingForHost, sessionNumber);
        let message = `${guestDisplayName}` + util_1.ExtensionUtil.getString('notification.AcceptRejectGuest');
        let selection = await vscode.window.showInformationMessage(message, ...[util_1.ExtensionUtil.getString('notification.Accept'), util_1.ExtensionUtil.getString('notification.Reject')]);
        await this.workspaceUserService.fireProgressUpdatedToGuestAsync(vsls.WorkspaceProgress.DoneWaitingForHost, sessionNumber);
        return selection === util_1.ExtensionUtil.getString('notification.Accept');
    }
    async showJoinNotification(sessionNumber, guestDisplayName) {
        let message = `${guestDisplayName}` + util_1.ExtensionUtil.getString('notification.InformGuestJoined');
        let selection = await vscode.window.showInformationMessage(message, ...[util_1.ExtensionUtil.getString('notification.Reject')]);
        if (selection === util_1.ExtensionUtil.getString('notification.Reject') && session_1.SessionContext.State === sessionTypes_1.SessionState.Shared) {
            await this.workspaceUserService.removeUserAsync(sessionNumber);
        }
    }
    async showGuestLeftNotification(e) {
        let nameAndEmail = this.getNameAndEmail(e.userProfile);
        switch (e.disconnectedReason) {
            case vsls.WorkspaceDisconnectedReason.NetworkDisconnected:
                {
                    let message = `${nameAndEmail}` + util_1.ExtensionUtil.getString('notification.GuestDisconnected');
                    await vscode.window.showInformationMessage(message);
                    break;
                }
            case vsls.WorkspaceDisconnectedReason.Requested:
                {
                    let message = `${nameAndEmail}` + util_1.ExtensionUtil.getString('notification.GuestLeft');
                    await vscode.window.showInformationMessage(message);
                    break;
                }
            case vsls.WorkspaceDisconnectedReason.UserRemoved:
            default:
                break;
        }
    }
    async getGuestDisplayName(userProfile) {
        let nameAndEmail = this.getNameAndEmail(userProfile);
        await this.guestNameSemaphore.acquire();
        try {
            if (this.guestNameCounts.has(nameAndEmail)) {
                let newCount = this.guestNameCounts
                    .set(nameAndEmail, this.guestNameCounts.get(nameAndEmail) + 1)
                    .get(nameAndEmail);
                return `${nameAndEmail} (${newCount})`;
            }
            else {
                this.guestNameCounts.set(nameAndEmail, 0);
                return nameAndEmail;
            }
        }
        finally {
            this.guestNameSemaphore.release();
        }
    }
    getNameAndEmail(userProfile) {
        let name = userProfile.name;
        let email = userProfile.email;
        return name ? `${name} (${email})` : email;
    }
    workspaceAccessControl_onAccessControlChanged(e) {
        super.workspaceAccessControl_onAccessControlChanged(e);
        session_1.SessionContext.IsReadOnly = this.workspaceAccessControl.defaultAccessControl.isReadOnly;
    }
    async initWorkspaceAccessControl() {
        await super.initWorkspaceAccessControl();
        this.workspaceAccessControlService.onOpeationAccessRequested(this.workspaceAccessControlService_OperationAccessRequested, this);
    }
    workspaceAccessControlService_OperationAccessRequested(e) {
        if (session_1.SessionContext.IsCollaborating) {
            this.requestOperationAccess(e.operation, e.sessionId);
        }
    }
    async requestOperationAccess(operation, sessionId) {
        try {
            let response;
            switch (operation.name) {
                case restrictedOperation_1.WellKnownRestrictedOperations.WriteToSharedTerminal:
                    response = await this.terminalManager.requestReadWriteAccessForTerminal(operation.terminalId, sessionId);
                    break;
                default:
                    break;
            }
            if (typeof response === 'boolean') {
                await this.workspaceAccessControlService.setOperationAccessAsync(operation, response ? vsls.RestrictedOperationAccess.Allowed : vsls.RestrictedOperationAccess.ExplicitlyRejectedByHost);
            }
        }
        catch (err) {
            const message = `Requesting access for '${operation ? operation.name : 'null'}' operation failed: ${err.message}`;
            traceSource_1.traceSource.error(message);
            telemetry_1.Instance.sendFault(telemetryStrings_1.TelemetryEventNames.REQUEST_OPERATION_ACCESS_FAULT, telemetry_1.FaultType.NonBlockingFault, message, err);
        }
    }
}
exports.WorkspaceAccessControlManager = WorkspaceAccessControlManager;

//# sourceMappingURL=workspaceAccessControlManager.js.map
