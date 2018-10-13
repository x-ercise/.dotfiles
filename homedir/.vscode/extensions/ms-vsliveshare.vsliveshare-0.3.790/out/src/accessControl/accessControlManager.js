//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vsls = require("../contracts/VSLS");
const session_1 = require("../session");
const clientAccessCheck_1 = require("./clientAccessCheck");
const sessionTypes_1 = require("../sessionTypes");
const restrictedOperation_1 = require("./restrictedOperation");
class AccessControlManager extends clientAccessCheck_1.ClientAccessCheck {
    constructor(workspaceAccessControlService, accessControlService, fileSystemManager, terminalManager) {
        super(workspaceAccessControlService);
        this.accessControlService = accessControlService;
        this.fileSystemManager = fileSystemManager;
        this.terminalManager = terminalManager;
        this.accessControl = {};
    }
    get isReadOnly() {
        return !!this.accessControl.isReadOnly;
    }
    async init() {
        await super.init();
        this.accessControl = await this.accessControlService.getAccessControlAsync() || {};
        this.accessControlService.onAccessControlChanged(this.accessControlChanged, this);
        session_1.SessionContext.IsReadOnly = this.isReadOnly;
        this.fileSystemManager.registerFileSystemProvider(this.isReadOnly);
        this.workspaceAccessControlService.onOperationRejected(this.workspaceAccessControlService_operationRejected, this);
        this.workspaceAccessControlService.onOperationAccessChanged(this.workspaceAccessControlService_operationAccessChanged, this);
    }
    async requestOperationAccess(operation) {
        await this.workspaceAccessControlService.requestOperationAccessAsync(operation);
    }
    accessControlChanged(e) {
        const oldReadOnly = this.isReadOnly;
        this.accessControl = e.accessControl || {};
        const isReadOnly = this.isReadOnly;
        if (oldReadOnly !== isReadOnly) {
            session_1.SessionContext.IsReadOnly = isReadOnly;
            this.fileSystemManager.registerFileSystemProvider(isReadOnly);
        }
        // TODO: Figure out how to update opened documents, VSCode doesn't update their read-only status properly.
        // See https://github.com/Microsoft/vscode/issues/53256
    }
    workspaceAccessControlService_operationRejected(e) {
        // Only request access to operations that can be enabled and that were initiated by us
        if (!e.operation
            || e.access !== vsls.RestrictedOperationAccess.DisabledByHostConfiguration
            || session_1.SessionContext.coeditingClient.clientID !== e.operation.sessionId
            || session_1.SessionContext.State !== sessionTypes_1.SessionState.Joined) {
            return;
        }
        if (e.operation.name === restrictedOperation_1.WellKnownRestrictedOperations.WriteToSharedTerminal) {
            const sharedTerminalOperation = (e.operation);
            this.terminalManager().terminalWriteAccessRejected(sharedTerminalOperation.terminalId, sharedTerminalOperation.isEscapeSequence);
        }
    }
    workspaceAccessControlService_operationAccessChanged(e) {
        if (!e.operation || session_1.SessionContext.State !== sessionTypes_1.SessionState.Joined) {
            return;
        }
        if (e.operation.name === restrictedOperation_1.WellKnownRestrictedOperations.WriteToSharedTerminal) {
            this.terminalManager().terminalWriteAccessChanged((e.operation).terminalId, e.access);
        }
    }
}
exports.AccessControlManager = AccessControlManager;

//# sourceMappingURL=accessControlManager.js.map
