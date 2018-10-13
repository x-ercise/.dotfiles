"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CommandBase {
    constructor() {
        this.postSetupManagers = [];
    }
    async invoke(options, context) {
        return true;
    }
    invokePostSetupManagers(sessionContext) {
        this.postSetupManagers.forEach(async (postSetupManager) => {
            await postSetupManager.instance.init();
            if (postSetupManager.status) {
                sessionContext.point(postSetupManager.status);
            }
        });
    }
}
exports.CommandBase = CommandBase;

//# sourceMappingURL=CommandBase.js.map
