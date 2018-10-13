"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var JoinTests_1;
const mocha_typescript_1 = require("mocha-typescript");
const workbench_1 = require("@vsliveshare/vscode-automation/areas/workbench/workbench");
const uiTestSuite_1 = require("./uiTestSuite");
const web = require("./web");
let JoinTests = JoinTests_1 = class JoinTests extends uiTestSuite_1.UITestSuite {
    static before() { return uiTestSuite_1.UITestSuite.startSharing(JoinTests_1.mochaContext, false); }
    static after() { return uiTestSuite_1.UITestSuite.endSharing(JoinTests_1.mochaContext, false); }
    async join() {
        // Get the workspace file created by the launcher (launched by the join web page).
        const joinWorkspaceFilePath = await web.join(this.inviteUri, this.extensionDir, true);
        // Open a new VS Code window using the workspace file. This simulates a web join.
        // (If the launcher was allowed to launch VS Code directly, it would not be automatable.)
        this.guestWindow = await this.openGuestWindow(joinWorkspaceFilePath);
        this.guestWorkbench = new workbench_1.Workbench(this.guestWindow, this.app.userDataPath);
        // The window should load with collaborating status.
        // Consume some of the time here to reduce the liklihood of the next wait timing out.
        await new Promise((c) => setTimeout(c, 5000));
        await this.waitForStatusBarTitle(this.guestWindow, 'Collaborating');
        // The host should receive a notification that the guest joined.
        await this.waitForAndDismissNotification(this.hostWindow, 'joined');
    }
    async unjoin() {
        await super.unjoin();
        // The guest window should remain signed in.
        await this.waitForStatusBarTitle(this.guestWindow, this.testAccount.email);
        // The host should receive a notification that the guest left.
        await this.waitForAndDismissNotification(this.hostWindow, 'has left');
    }
    async joinAndEndSession() {
        await super.join();
        // Unsharing too quickly can cause some other error notifications.
        await new Promise((c) => setTimeout(c, 2000));
        await super.unshare();
        // The guest should receive a notification that the session ended.
        await this.waitForAndDismissNotification(this.guestWindow, 'owner has ended');
        // Wait until the window reload has surely started, to avoid
        // detecting the status before the reload.
        await new Promise((c) => setTimeout(c, 4000));
        // The guest window should reload in an unjoined state.
        await this.waitForStatusBarTitle(this.guestWindow, /(Start Collaboration)|(Share the workspace)/);
    }
    async joinAndDisconnectGuest() {
        await super.share('relay');
        await super.join();
        // Closing the workspace (without using the leave session command) kills the
        // guest agent and therefore causes the host to perceive the guest disconnected.
        await this.closeWorkspace(this.guestWindow);
        await this.waitForAndDismissNotification(this.hostWindow, 'was disconnected');
        // Wait until the window reload has surely started, to avoid
        // detecting the status before the reload.
        await new Promise((c) => setTimeout(c, 4000));
        // The guest window should reload in an unjoined state.
        await this.waitForStatusBarTitle(this.guestWindow, /(Start Collaboration)|(Share the workspace)/);
    }
    async joinAndReloadHost() {
        await super.join();
        // Reloading the window is (for now) effectively the same as unsharing.
        // The guest should receive a notification that the session ended.
        await this.reloadWindow(this.hostWindow);
        await this.waitForAndDismissNotification(this.guestWindow, 'owner has ended');
        // Wait until the window reload has surely started, to avoid
        // detecting the status before the reload.
        await new Promise((c) => setTimeout(c, 4000));
        // The guest and host windows should reload in a signed-in, unjoined state.
        await this.waitForStatusBarTitle(this.guestWindow, /(Start Collaboration)|(Share the workspace)/);
        await this.waitForStatusBarTitle(this.hostWindow, /(Start Collaboration)|(Share the workspace)/);
    }
};
__decorate([
    mocha_typescript_1.test(mocha_typescript_1.slow(30000), mocha_typescript_1.timeout(90000))
], JoinTests.prototype, "join", null);
__decorate([
    mocha_typescript_1.test
], JoinTests.prototype, "unjoin", null);
__decorate([
    mocha_typescript_1.test
], JoinTests.prototype, "joinAndEndSession", null);
__decorate([
    mocha_typescript_1.test
], JoinTests.prototype, "joinAndDisconnectGuest", null);
__decorate([
    mocha_typescript_1.test
], JoinTests.prototype, "joinAndReloadHost", null);
__decorate([
    mocha_typescript_1.context
], JoinTests, "mochaContext", void 0);
JoinTests = JoinTests_1 = __decorate([
    mocha_typescript_1.suite
], JoinTests);
exports.JoinTests = JoinTests;

//# sourceMappingURL=join.test.js.map
