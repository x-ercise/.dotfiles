"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const joinUtilities_1 = require("../../workspace/joinUtilities");
class AdditionalRootsManager {
    constructor(dependencies) {
        this.sessionContext = dependencies.sessionContext();
        this.fileService = dependencies.fileService();
    }
    async init() {
        joinUtilities_1.JoinUtilities.addAdditionalRootsFromFileServiceToWorkspace(this.fileService, this.sessionContext.workspaceSessionInfo);
    }
    async dispose() { }
}
exports.AdditionalRootsManager = AdditionalRootsManager;

//# sourceMappingURL=AdditionalRootsManager.js.map
