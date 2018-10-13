"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const WorkspaceTaskService = require("../../tasks/workspaceTaskService");
class WorkspaceTaskManager {
    constructor(rpcClient, workspaceService, clientAccessCheck) {
        this.rpcClient = rpcClient;
        this.workspaceService = workspaceService;
        this.clientAccessCheck = clientAccessCheck;
    }
    init() {
        return WorkspaceTaskService.enable(this.rpcClient, this.workspaceService, this.clientAccessCheck);
    }
    dispose() {
        return WorkspaceTaskService.disable();
    }
}
exports.WorkspaceTaskManager = WorkspaceTaskManager;

//# sourceMappingURL=WorkspaceTaskManager.js.map
