"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var TerminalTests_1;
const mocha_typescript_1 = require("mocha-typescript");
const uiTestSuite_1 = require("./uiTestSuite");
// tslint:disable:member-access
let TerminalTests = TerminalTests_1 = class TerminalTests extends uiTestSuite_1.UITestSuite {
    static before() {
        return uiTestSuite_1.UITestSuite.startSharing(TerminalTests_1.mochaContext);
    }
    static after() {
        return uiTestSuite_1.UITestSuite.endSharing(TerminalTests_1.mochaContext);
    }
    async autoShareTerminal() {
        // Auto sharing is enabled by default.
        const expected = new Date().getTime().toString();
        await this.hostWorkbench.terminal.showTerminal();
        await this.hostWorkbench.terminal.runCommand(`echo ${expected}`);
        // it might take a while for a guest terminal window to appear
        await new Promise(c => setTimeout(c, 3000));
        // The terminal might not be visible if a different panel
        // (like debug console) is open.
        await this.guestWorkbench.quickopen.runCommand('Terminal: Focus Terminal');
        await this.guestWorkbench.terminal.waitForTerminalText(terminalText => {
            // scan over terminal buffer lines in a reverse order
            for (let index = terminalText.length - 1; index >= 0; index--) {
                if (!!terminalText[index] && terminalText[index].trim() === expected) {
                    return true;
                }
            }
            return false;
        });
        // TODO: also compare terminal buffers on guest vs. host sides
    }
    static async getTerminalBuffer(testWindow) {
        const PANEL_SELECTOR = 'div[id="workbench.panel.terminal"]';
        const XTERM_SELECTOR = `${PANEL_SELECTOR} .terminal-wrapper`;
        const windowId = await testWindow.getActiveWindowId();
        const driver = testWindow.driver;
        const buffer = await driver.getTerminalBuffer(windowId, XTERM_SELECTOR);
        return buffer;
    }
};
__decorate([
    mocha_typescript_1.test
], TerminalTests.prototype, "autoShareTerminal", null);
__decorate([
    mocha_typescript_1.context
], TerminalTests, "mochaContext", void 0);
TerminalTests = TerminalTests_1 = __decorate([
    mocha_typescript_1.suite
], TerminalTests);
exports.TerminalTests = TerminalTests;

//# sourceMappingURL=terminal.test.js.map
