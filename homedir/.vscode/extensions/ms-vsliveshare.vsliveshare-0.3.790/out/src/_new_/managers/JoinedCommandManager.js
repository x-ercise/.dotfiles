"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class JoinedCommandManager {
    constructor(dependencies) {
        this.sessionContext = dependencies.sessionContext();
    }
    async init() {
        this.sessionContext.joined();
    }
    async dispose() { }
}
exports.JoinedCommandManager = JoinedCommandManager;

//# sourceMappingURL=JoinedCommandManager.js.map
