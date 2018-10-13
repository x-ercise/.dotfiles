"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CoEditingManagerBase {
    constructor(dependencies) {
        this.authenticationProvider = dependencies.authenticationProvider();
        this.sessionContext = dependencies.sessionContext();
        this.sourceEventService = dependencies.sourceEventService();
        this.fileService = dependencies.fileService();
        this.statusBarController = dependencies.statusBarController();
        this.clientAccessCheck = dependencies.clientAccessCheck;
    }
    async init(isExpert = false) {
        this.sessionContext.initCoEditingContext({
            sourceEventService: this.sourceEventService,
            userInfo: this.authenticationProvider.getCurrentUser(),
            statusBarController: this.statusBarController,
            fileSystemService: this.fileService,
            clientAccessCheck: this.clientAccessCheck,
            isExpert,
        });
    }
    async dispose() { }
}
class CoEditingHostManager extends CoEditingManagerBase {
    async init() {
        super.init(false);
    }
}
exports.CoEditingHostManager = CoEditingHostManager;
class CoEditingGuestManager extends CoEditingManagerBase {
    async init() {
        super.init(true);
    }
}
exports.CoEditingGuestManager = CoEditingGuestManager;

//# sourceMappingURL=CoEditingManager.js.map
