"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var DebugTests_1;
const http = require("http");
const mocha_typescript_1 = require("mocha-typescript");
const uiTestSuite_1 = require("./uiTestSuite");
let DebugTests = DebugTests_1 = class DebugTests extends uiTestSuite_1.UITestSuite {
    static before() { return uiTestSuite_1.UITestSuite.startSharing(DebugTests_1.mochaContext); }
    static after() { return uiTestSuite_1.UITestSuite.endSharing(DebugTests_1.mochaContext); }
    async guestSetBreakpoint() {
        await this.guestWorkbench.quickopen.openFile('index.js');
        // Dismiss sticky input box.
        await this.guestWindow.dispatchKeybinding('escape');
        await this.guestWorkbench.debug.setBreakpointOnLine(6);
        // Verify the breakpoint appears on the host side.
        await this.hostWorkbench.quickopen.openFile('index.js');
        await this.hostWindow.waitForElement('.debug-breakpoint');
        // Dismiss sticky input box.
        await this.hostWindow.dispatchKeybinding('escape');
    }
    async hostStartDebuggingNoLaunchConfig() {
        DebugTests_1.appPort = await this.hostWorkbench.debug.startDebugging();
        // Make a request that will hit the breakpoint.
        await new Promise((c, e) => {
            const request = http.get(`http://localhost:${DebugTests_1.appPort}`);
            request.on('error', e);
            // Wait for the host to hit the breakpoint.
            this.waitForStackFrame(this.hostWorkbench, 'index.js', 6)
                .then(c, e);
        });
        // Wait for the guest to hit the breakpoint.
        await this.waitForStackFrame(this.guestWorkbench, 'index.js', 6);
    }
    async guestStackFramesAndVariables() {
        // Ensure the debug variables viewlet is visible and the Locals tree item is expanded.
        await this.guestWorkbench.quickopen.runCommand('Debug: Focus Variables');
        await this.guestWindow.waitAndClick('.debug-view-content .scope');
        await this.guestWindow.dispatchKeybinding('right');
        await this.guestWorkbench.debug.waitForVariableCount(4);
        await this.guestWorkbench.debug.focusStackFrame('layer.js', 'looking for layer.js');
        await this.guestWorkbench.debug.waitForVariableCount(5);
        await this.guestWorkbench.debug.focusStackFrame('route.js', 'looking for route.js');
        await this.guestWorkbench.debug.waitForVariableCount(3);
        await this.guestWorkbench.debug.focusStackFrame('index.js', 'looking for index.js');
        await this.guestWorkbench.debug.waitForVariableCount(4);
    }
    async guestStepOverInOut() {
        await this.wait();
        await this.guestWorkbench.debug.stepIn();
        const first = await this.waitForStackFrame(this.guestWorkbench, 'response.js');
        await this.wait();
        await this.guestWorkbench.debug.stepOver();
        await this.waitForStackFrame(this.guestWorkbench, 'response.js', first.lineNumber + 1);
        await this.wait();
        await this.guestWorkbench.debug.stepOut();
        await this.waitForStackFrame(this.guestWorkbench, 'index.js', 7);
    }
    async guestContinue() {
        await this.guestWorkbench.debug.continue();
        // Wait for the host to continue.
        await this.hostWindow.waitForElement('.debug-action.pause');
        // Make another request and wait for the breakpoint to hit again.
        await new Promise((c, e) => {
            const request = http.get(`http://localhost:${DebugTests_1.appPort}`);
            request.on('error', e);
            this.waitForStackFrame(this.hostWorkbench, 'index.js', 6)
                .then(c, e);
        });
        await this.waitForStackFrame(this.guestWorkbench, 'index.js', 6);
    }
    async hostRestartDebuggingNoLaunchConfig() {
        await this.guestWorkbench.debug.setBreakpointOnLine(5);
        await this.restartDebuggingHost();
        await this.ensureBreakpointsHitOnHostAndGuest();
    }
    async guestRestartDebuggingNoLaunchConfig() {
        await this.restartDebuggingGuest();
        await this.ensureBreakpointsHitOnHostAndGuest();
    }
    async guestDisconnectDebugging() {
        await this.disconnectDebugging(this.guestWindow);
    }
    async hostStop() {
        // stopDebugging() doesn't find the hidden toolbar on Mac.
        //await this.hostWorkbench.debug.stopDebugging();
        await this.hostWindow.waitAndClick('.debug-actions-widget .debug-action.stop');
        await this.hostWindow.waitForElement('.statusbar:not(debugging)');
    }
    async guestStartDebuggingNoLaunchConfig() {
        await this.wait();
        await this.changeSettings({ 'liveshare.allowGuestDebugControl': true });
        // Wait for launch.json to be generated
        await this.startDebuggingGuest();
        await this.guestWorkbench.editors.waitForTab('launch.json');
        // Guest initiated debugging
        await this.startDebuggingGuest();
        await this.ensureBreakpointsHitOnHostAndGuest();
    }
    async hostRestartDebuggingWithLaunchConfig() {
        await this.restartDebuggingHost();
        await this.ensureBreakpointsHitOnHostAndGuest();
    }
    async guestRestartDebuggingWithLaunchConfig() {
        await this.restartDebuggingGuest();
        await this.ensureBreakpointsHitOnHostAndGuest();
        await this.guestDisconnectDebugging();
        await this.hostStop();
    }
    async guestStartDebuggingWithLaunchConfig() {
        await this.wait();
        await this.startDebuggingGuest();
        await this.ensureBreakpointsHitOnHostAndGuest();
    }
    async guestStop() {
        await this.guestWindow.waitAndClick('.debug-actions-widget .debug-action.stop');
        await this.guestWindow.waitForElement('.statusbar:not(debugging)');
    }
    async hostStartDebuggingWithLaunchConfig() {
        await this.wait();
        await this.hostWindow.dispatchKeybinding('f5');
        await this.ensureBreakpointsHitOnHostAndGuest();
    }
    async startDebuggingGuest() {
        await this.guestWindow.waitAndClick('.start-debug-action-item .icon');
    }
    async restartDebuggingHost() {
        await this.hostWindow.waitAndClick('.debug-actions-widget .debug-action.restart');
    }
    async restartDebuggingGuest() {
        await this.guestWindow.waitAndClick('.debug-actions-widget .debug-action.restart');
    }
    async wait() {
        // set timeout to ensure subsequent actions pass
        await new Promise((c) => setTimeout(c, 1000));
    }
    async ensureBreakpointsHitOnHostAndGuest() {
        // Wait for host to start debugging
        await this.hostWindow.waitForElement(`.statusbar.debugging`);
        // Wait for the host to hit the breakpoint.
        await this.waitForStackFrame(this.hostWorkbench, 'index.js', 5);
        // Wait for the guest to hit the breakpoint.
        await this.waitForStackFrame(this.guestWorkbench, 'index.js', 5);
        await this.wait();
    }
    async waitForStackFrame(workbench, fileName, lineNumber) {
        const role = (workbench === this.hostWorkbench ? 'host' :
            workbench === this.guestWorkbench ? 'guest' : 'other');
        const regExp = new RegExp(fileName.replace('.', '\\.') + '$');
        const message = `looking for ${fileName} and line ${lineNumber} on ${role}`;
        this.logger.log(message);
        let foundStackFrames = false;
        let foundFileName = false;
        try {
            return await workbench.debug.waitForStackFrame((sf) => {
                foundStackFrames = true;
                if (regExp.test(sf.name)) {
                    foundFileName = true;
                    if (typeof lineNumber === 'undefined' ||
                        sf.lineNumber === lineNumber) {
                        return true;
                    }
                }
                return false;
            }, message);
        }
        catch (e) {
            if (!foundStackFrames) {
                throw new Error(`Failed to find stack frame elements on ${role}`);
            }
            else if (!foundFileName) {
                throw new Error(`Did not find stack frame(s) for ${fileName} on ${role}`);
            }
            else {
                throw new Error(`Did not find stack frame for ${fileName}:${lineNumber} on ${role}`);
            }
        }
    }
    async disconnectDebugging(window) {
        const DISCONNECT = `.debug-actions-widget .debug-action.disconnect`;
        const TOOLBAR_HIDDEN = `.debug-actions-widget.monaco-builder-hidden`;
        const NOT_DEBUG_STATUS_BAR = `.statusbar:not(debugging)`;
        await window.waitAndClick(DISCONNECT);
        await window.waitForElement(TOOLBAR_HIDDEN);
        await window.waitForElement(NOT_DEBUG_STATUS_BAR);
    }
};
__decorate([
    mocha_typescript_1.test
], DebugTests.prototype, "guestSetBreakpoint", null);
__decorate([
    mocha_typescript_1.test
], DebugTests.prototype, "hostStartDebuggingNoLaunchConfig", null);
__decorate([
    mocha_typescript_1.test
], DebugTests.prototype, "guestStackFramesAndVariables", null);
__decorate([
    mocha_typescript_1.test
], DebugTests.prototype, "guestStepOverInOut", null);
__decorate([
    mocha_typescript_1.test
], DebugTests.prototype, "guestContinue", null);
__decorate([
    mocha_typescript_1.test
], DebugTests.prototype, "hostRestartDebuggingNoLaunchConfig", null);
__decorate([
    mocha_typescript_1.test
], DebugTests.prototype, "guestRestartDebuggingNoLaunchConfig", null);
__decorate([
    mocha_typescript_1.test
], DebugTests.prototype, "guestDisconnectDebugging", null);
__decorate([
    mocha_typescript_1.test
], DebugTests.prototype, "hostStop", null);
__decorate([
    mocha_typescript_1.test
], DebugTests.prototype, "guestStartDebuggingNoLaunchConfig", null);
__decorate([
    mocha_typescript_1.test
], DebugTests.prototype, "hostRestartDebuggingWithLaunchConfig", null);
__decorate([
    mocha_typescript_1.test
], DebugTests.prototype, "guestRestartDebuggingWithLaunchConfig", null);
__decorate([
    mocha_typescript_1.test
], DebugTests.prototype, "guestStartDebuggingWithLaunchConfig", null);
__decorate([
    mocha_typescript_1.test
], DebugTests.prototype, "guestStop", null);
__decorate([
    mocha_typescript_1.test
], DebugTests.prototype, "hostStartDebuggingWithLaunchConfig", null);
__decorate([
    mocha_typescript_1.context
], DebugTests, "mochaContext", void 0);
DebugTests = DebugTests_1 = __decorate([
    mocha_typescript_1.suite
], DebugTests);
exports.DebugTests = DebugTests;

//# sourceMappingURL=debug.test.js.map
