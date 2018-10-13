"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const joinDebugManager_1 = require("../../debugger/joinDebugManager");
class JoinDebugManagerFacade {
    constructor(dependencies) {
        this.sessionContext = dependencies.sessionContext();
        this.rpcClient = dependencies.rpcClient();
        this.fileSystemManager = dependencies.fileSystemManager();
        this.debuggerHostService = dependencies.debuggerHostService();
        this.hostAdapterService = dependencies.hostAdapterService();
    }
    async init() {
        // Create debugger manager instances
        const joinDebugManager = new joinDebugManager_1.JoinDebugManager(this.rpcClient, this.sessionContext.workspaceSessionInfo.id, this.fileSystemManager.workspaceProvider, this.debuggerHostService, this.hostAdapterService);
        await joinDebugManager.initialize();
        this.sessionContext.joinDebugManager = joinDebugManager;
    }
    async dispose() { }
}
exports.JoinDebugManagerFacade = JoinDebugManagerFacade;

//# sourceMappingURL=JoinDebugManagerFacade.js.map
