"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lspServer = require("../../languageService/lspServer");
class LspServerManager {
    constructor(workspaceService, clientAccessCheck) {
        this.workspaceService = workspaceService;
        this.clientAccessCheck = clientAccessCheck;
    }
    init() {
        return lspServer.activateAsync(this.workspaceService, this.clientAccessCheck);
    }
    dispose() {
        return lspServer.dispose();
    }
    setupHandlers(languageServerProvider) {
        lspServer.setupHandlers(languageServerProvider, this.clientAccessCheck);
    }
}
exports.LspServerManager = LspServerManager;

//# sourceMappingURL=LspServerManager.js.map
