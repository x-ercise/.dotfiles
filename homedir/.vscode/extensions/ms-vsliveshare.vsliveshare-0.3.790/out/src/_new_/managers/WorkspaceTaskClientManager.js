"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const WorkspaceTaskClient = require("../../tasks/workspaceTaskClient");
class WorkspaceTaskClientManager {
    constructor(rpcClient) {
        this.rpcClient = rpcClient;
    }
    async init() {
        await WorkspaceTaskClient.enable(this.rpcClient);
    }
    async dispose() { }
}
exports.WorkspaceTaskClientManager = WorkspaceTaskClientManager;

//# sourceMappingURL=WorkspaceTaskClientManager.js.map
