//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vsls = require("../contracts/VSLS");
const sessionTypes_1 = require("../sessionTypes");
const vscode_jsonrpc_1 = require("vscode-jsonrpc");
const restrictedOperation_1 = require("./restrictedOperation");
const telemetryStrings_1 = require("../telemetry/telemetryStrings");
const telemetry_1 = require("../telemetry/telemetry");
function getClientAccessCheck(dependencies) {
    const state = dependencies.sessionContext().State;
    switch (state) {
        case sessionTypes_1.SessionState.SharingInProgress:
        case sessionTypes_1.SessionState.Shared:
            return dependencies.workspaceAccessControlManager();
        case sessionTypes_1.SessionState.JoiningInProgress:
        case sessionTypes_1.SessionState.Joined:
            return dependencies.accessControlManager();
        default:
            throw new Error(`IClientAccessCheck is not available in session state '${state}'.`);
    }
}
exports.getClientAccessCheck = getClientAccessCheck;
class ClientAccessCheck {
    constructor(workspaceAccessControlService) {
        this.workspaceAccessControlService = workspaceAccessControlService;
    }
    async isClientReadOnly(context) {
        if (context && typeof context === 'object') {
            context = typeof context.GuestSessionId !== 'undefined' ? context.GuestSessionId :
                typeof context.context === 'object' ? context.context.GuestSessionId :
                    undefined;
        }
        if (typeof context === 'number') {
            context = context.toString();
        }
        if (typeof context !== 'string') {
            return false;
        }
        if (context === '1') {
            // Session 1 is always the host because it connects first to the agent; the host is never read-only.
            return false;
        }
        if (!this.workspaceAccessControl) {
            await this.initWorkspaceAccessControl();
        }
        const accessControl = this.workspaceAccessControl.userAccessControl[context] || this.workspaceAccessControl.defaultAccessControl || {};
        return !!accessControl.isReadOnly;
    }
    async canPerformOperation(context, operation) {
        if (!operation) {
            return true;
        }
        if (!operation.enabledInReadOnlySession && await this.isClientReadOnly(context)) {
            this.sendRejectedOperationTelemetry(operation, restrictedOperation_1.RestrictedOperationRejectionReason.RejectedInReadOnlySession);
            return false;
        }
        if (operation.isEnabled && operation.isEnabled() !== true) {
            this.sendRejectedOperationTelemetry(operation, restrictedOperation_1.RestrictedOperationRejectionReason.DisabledByHost);
            return false;
        }
        return true;
    }
    async verifyCanPerformOperation(context, operation) {
        if (await this.canPerformOperation(context, operation)) {
            return;
        }
        if (!operation.enabledInReadOnlySession && await this.isClientReadOnly(context)) {
            throw new vscode_jsonrpc_1.ResponseError(vsls.ErrorCodes.OperationRejectedInReadOnlySession, 'This operation is not allowed in read-only collaboration session.');
        }
        if (operation.isEnabled) {
            const error = operation.isEnabled();
            if (error && typeof error === 'object') {
                throw new vscode_jsonrpc_1.ResponseError(error.errorCode, error.errorMessage);
            }
        }
        throw new vscode_jsonrpc_1.ResponseError(vsls.ErrorCodes.OperationRejected, 'Insufficient access rights to perform this operation.');
    }
    async init() {
        await this.initWorkspaceAccessControl();
    }
    async dispose() {
        this.endCollaboration();
    }
    endCollaboration() {
        if (this.accessControlChangedEvent) {
            this.accessControlChangedEvent.dispose();
            this.accessControlChangedEvent = undefined;
        }
        this.workspaceAccessControl = undefined;
    }
    workspaceAccessControl_onAccessControlChanged(e) {
        this.workspaceAccessControl = e.accessControl || {};
        this.workspaceAccessControl.defaultAccessControl = this.workspaceAccessControl.defaultAccessControl || {};
    }
    async initWorkspaceAccessControl() {
        this.workspaceAccessControl = await this.workspaceAccessControlService.getAccessControlAsync() || {};
        this.accessControlChangedEvent = this.workspaceAccessControlService.onAccessControlChanged(this.workspaceAccessControl_onAccessControlChanged, this);
    }
    sendRejectedOperationTelemetry(operation, reason) {
        new telemetry_1.TelemetryEvent(telemetryStrings_1.TelemetryEventNames.REJECT_RESTRICTED_OPERATION)
            .addProperty(telemetryStrings_1.TelemetryPropertyNames.OPERATION_NAME, operation.name)
            .addProperty(telemetryStrings_1.TelemetryPropertyNames.REJECTION_REASON, reason)
            .send();
    }
}
exports.ClientAccessCheck = ClientAccessCheck;

//# sourceMappingURL=clientAccessCheck.js.map
