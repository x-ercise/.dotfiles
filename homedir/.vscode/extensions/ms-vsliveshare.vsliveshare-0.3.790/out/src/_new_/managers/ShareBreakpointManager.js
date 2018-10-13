"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ShareBreakpointManager {
    constructor(builder) {
        this.builder = builder;
    }
    init() {
        return this.builder.init(true);
    }
    dispose() {
        return this.builder.dispose();
    }
}
exports.ShareBreakpointManager = ShareBreakpointManager;

//# sourceMappingURL=ShareBreakpointManager.js.map
