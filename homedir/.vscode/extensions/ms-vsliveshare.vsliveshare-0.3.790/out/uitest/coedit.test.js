"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var CoeditingTests_1;
const mocha_typescript_1 = require("mocha-typescript");
const uiTestSuite_1 = require("./uiTestSuite");
const assert = require("assert");
let CoeditingTests = CoeditingTests_1 = class CoeditingTests extends uiTestSuite_1.UITestSuite {
    static before() { return uiTestSuite_1.UITestSuite.startSharing(CoeditingTests_1.mochaContext); }
    static after() { return uiTestSuite_1.UITestSuite.endSharing(CoeditingTests_1.mochaContext); }
    async bash() {
        await this.hostWorkbench.quickopen.openFile('readme.md');
        await this.guestWorkbench.editors.waitForTab('readme.md');
        await this.waitForAndClickStatusBarTitle(this.hostWindow, 'Start bashing');
        await this.waitForAndClickStatusBarTitle(this.guestWindow, 'Start bashing');
        // Wait for the bashing.
        // The status will change for the duration of bashing, then change back when done.
        // Consume some of the time here so the following waits are less likely to time-out.
        await new Promise((c) => setTimeout(c, 15000));
        await this.waitForStatusBarTitle(this.hostWindow, 'Start bashing');
        await this.waitForStatusBarTitle(this.guestWindow, 'Start bashing');
        // Get the hash on the guest side.
        const hostHash = await this.getHash(this.hostWindow);
        const guestHash = await this.getHash(this.guestWindow);
        assert.equal(hostHash, guestHash, 'Document hashes should match after bashing.');
        await this.hostWorkbench.quickopen.runCommand('View: Revert and Close Editor');
        await this.guestWorkbench.quickopen.runCommand('View: Revert and Close Editor');
    }
    async getHash(window) {
        await this.waitForAndClickStatusBarTitle(window, 'hash of the current');
        await new Promise((c) => setTimeout(c, 100));
        const hashSelector = await this.waitForStatusBarTitle(window, 'hash of the current');
        const hashElement = await window.waitForElement(hashSelector);
        return parseInt(hashElement.textContent);
    }
    async summonAccept() {
        await this.summon('accept');
    }
    async summonPrompt() {
        await this.summon('prompt');
    }
    async summon(focusBehavior) {
        await this.changeSettings({ 'liveshare.focusBehavior': focusBehavior });
        await this.hostWorkbench.quickopen.runCommand('View: Close All Editors');
        await this.guestWorkbench.quickopen.runCommand('View: Close All Editors');
        // TODO: `this.guestWorkbench` implies only one guest, maybe we should do
        // `this.guestWorkbench[index]` instead some day
        await this.guestWorkbench.quickopen.openFile('index.js');
        await this.guestWorkbench.quickopen.openQuickOpen(':10');
        await this.guestWindow.dispatchKeybinding('enter');
        await this.runLiveShareCommand(this.guestWorkbench, 'liveshare.focusParticipants');
        await this.waitForAndDismissNotification(this.guestWindow, 'Focus request sent.');
        if (focusBehavior === 'prompt') {
            await this.waitForAndClickNotificationButton(this.hostWindow, 'requested you to follow', 'Follow');
        }
        await this.hostWorkbench.editors.waitForTab('index.js');
        // TODO: Check that we're on the correct line.
    }
};
__decorate([
    mocha_typescript_1.test(mocha_typescript_1.slow(60000), mocha_typescript_1.timeout(120000))
], CoeditingTests.prototype, "bash", null);
__decorate([
    mocha_typescript_1.test
], CoeditingTests.prototype, "summonAccept", null);
__decorate([
    mocha_typescript_1.test
], CoeditingTests.prototype, "summonPrompt", null);
__decorate([
    mocha_typescript_1.context
], CoeditingTests, "mochaContext", void 0);
CoeditingTests = CoeditingTests_1 = __decorate([
    mocha_typescript_1.suite
], CoeditingTests);
exports.CoeditingTests = CoeditingTests;

//# sourceMappingURL=coedit.test.js.map
