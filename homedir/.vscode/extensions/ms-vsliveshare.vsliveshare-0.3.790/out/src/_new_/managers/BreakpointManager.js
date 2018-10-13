"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const breakpointManager_1 = require("../../debugger/breakpointManager");
class BreakpointManager {
    constructor(sourceEventService) {
        this.sourceEventService = sourceEventService;
    }
    async init(isSharing) {
        if (breakpointManager_1.BreakpointManager.hasVSCodeSupport()) {
            this.breakpointManager = new breakpointManager_1.BreakpointManager(isSharing, this.sourceEventService);
            await this.breakpointManager.initialize();
        }
    }
    async dispose() {
        if (this.breakpointManager) {
            await this.breakpointManager.dispose();
        }
    }
}
exports.BreakpointManager = BreakpointManager;

//# sourceMappingURL=BreakpointManager.js.map
