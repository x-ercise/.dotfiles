"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const textSearchService_1 = require("../../textSearchService");
class TextSearchManager {
    constructor(workspaceService) {
        this.textSearchService = new textSearchService_1.TextSearchService(workspaceService);
    }
    async init() {
        return await this.textSearchService.initAsync();
    }
    dispose() {
        return this.textSearchService.dispose();
    }
}
exports.TextSearchManager = TextSearchManager;

//# sourceMappingURL=TextSearchManager.js.map
