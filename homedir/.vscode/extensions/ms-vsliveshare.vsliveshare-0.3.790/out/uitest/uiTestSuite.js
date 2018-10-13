"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const fs = require("fs");
const fs_extra_1 = require("fs-extra");
const path = require("path");
const util = require("util");
const os = require("os");
const web = require("./web");
const mocha_typescript_1 = require("mocha-typescript");
const code_1 = require("@vsliveshare/vscode-automation/vscode/code");
const workbench_1 = require("@vsliveshare/vscode-automation/areas/workbench/workbench");
const clipboardy_1 = require("clipboardy");
const quickinput_1 = require("@vsliveshare/vscode-automation/areas/quickinput/quickinput");
/**
 * Base class for UI test suites.
 */
class UITestSuite {
    get app() { return this.mochaContext && this.mochaContext.app; }
    get logger() { return this.app && this.app.logger; }
    get currentTestName() {
        const currentTest = this.mochaContext && this.mochaContext.test;
        if (!currentTest)
            return undefined;
        return `${currentTest.parent.title}.${currentTest.title}`;
    }
    get currentLogsDir() {
        const logsDir = this.mochaContext && this.mochaContext.logsDir;
        if (!logsDir)
            return undefined;
        const currentTestName = this.currentTestName;
        return currentTestName ? path.join(logsDir, currentTestName) : logsDir;
    }
    get testAccount() {
        return this.mochaContext && this.mochaContext.testAccount;
    }
    get serviceUri() {
        return this.mochaContext && this.mochaContext.serviceUri;
    }
    get extensionDir() {
        return this.mochaContext && this.mochaContext.extensionDir;
    }
    get extensionInfo() {
        return this.extensionDir && require(path.join(this.extensionDir, 'package.json'));
    }
    get hostWindow() { return UITestSuite._hostWindow; }
    set hostWindow(value) { UITestSuite._hostWindow = value; }
    get guestWindow() { return UITestSuite._guestWindow; }
    set guestWindow(value) { UITestSuite._guestWindow = value; }
    get hostWorkbench() { return UITestSuite._hostWorkbench; }
    set hostWorkbench(value) { UITestSuite._hostWorkbench = value; }
    get guestWorkbench() { return UITestSuite._guestWorkbench; }
    set guestWorkbench(value) { UITestSuite._guestWorkbench = value; }
    get inviteUri() { return UITestSuite._inviteUri; }
    set inviteUri(value) { UITestSuite._inviteUri = value; }
    /** Signs in the test user (in the host window), if not already signed in. */
    static async ensureSignedIn(context) {
        const suite = new UITestSuite();
        suite.mochaContext = context;
        const signedIn = await suite.checkForStatusBarTitle(suite.hostWindow, suite.testAccount.email);
        if (!signedIn) {
            const userCode = await web.signIn(suite.serviceUri, 'microsoft', suite.testAccount.email, suite.testAccount.password, false);
            assert(userCode, 'Should have gotten a user code from browser sign-in.');
            await suite.runLiveShareCommand(suite.hostWorkbench, 'liveshare.signin.token');
            await suite.hostWorkbench.quickinput.waitForQuickInputOpened();
            await suite.hostWindow.waitForSetValue(quickinput_1.QuickInput.QUICK_INPUT_INPUT, userCode);
            await suite.hostWindow.dispatchKeybinding('enter');
            await suite.waitForStatusBarTitle(suite.hostWindow, suite.testAccount.email);
        }
    }
    /** Call from a static before() method in a subclass to start sharing before a test suite. */
    static async startSharing(context, join = true) {
        await UITestSuite.ensureSignedIn(context);
        const suite = new UITestSuite();
        suite.mochaContext = context;
        await suite.share();
        if (join) {
            await suite.join();
        }
        // Wait a bit for things to settle after sharing/joining. For some reason
        // this makes it less likely for focus to be stolen from a quickopen (command)
        // input box immediately afterward.
        await new Promise((c) => setTimeout(c, 2000));
    }
    /** Call from a static after() method in a subclass to end sharing after a test suite. */
    static async endSharing(context, unjoin = true) {
        const suite = new UITestSuite();
        suite.mochaContext = context;
        if (unjoin) {
            await suite.unjoin();
        }
        await suite.unshare();
    }
    async captureScreenshot(window, name) {
        if (!name.toLowerCase().endsWith('.png')) {
            name += '.png';
        }
        const screenshotPath = path.join(this.currentLogsDir, name);
        const raw = await window.capturePage();
        const buffer = new Buffer(raw, 'base64');
        await fs_extra_1.mkdirp(this.currentLogsDir);
        await util.promisify(fs.writeFile)(screenshotPath, buffer);
    }
    async openGuestWindow(workspaceFilePath) {
        if (!workspaceFilePath) {
            await this.hostWorkbench.quickopen.runCommand('New Window');
        }
        else {
            await this.openFolderOrWorkspace(this.hostWindow, workspaceFilePath, true);
        }
        let newWindowId;
        await this.hostWindow.waitForWindowIds((ids) => {
            // TODO: Handle >2 windows.
            if (ids.length === 2) {
                newWindowId = ids[1];
                return true;
            }
        });
        return await this.getNewWindow(this.hostWindow, newWindowId);
    }
    async openFolderOrWorkspace(window, path, openInNewWindow) {
        const workspaceUri = 'file://' + path;
        await this.executeCommand(window, 'delay+vscode.openFolder', workspaceUri, openInNewWindow);
    }
    async reloadWindow(window) {
        await this.executeCommand(window, 'delay+workbench.action.reloadWindow');
    }
    async closeWorkspace(window) {
        await this.executeCommand(window, 'delay+workbench.action.closeFolder');
    }
    async closeWindow(window) {
        await this.executeCommand(window, 'delay+workbench.action.closeWindow');
        if (window === this.guestWindow) {
            this.guestWindow = null;
        }
    }
    /**
     * Uses a test hook in the VSLS extension to execute an arbitrary VS Code command.
     */
    async executeCommand(window, command, ...args) {
        await window.dispatchKeybinding('ctrl+shift+alt+f1');
        const commandAndArgs = `${command} ${JSON.stringify(args)}`;
        await window.waitForSetValue(quickinput_1.QuickInput.QUICK_INPUT_INPUT, commandAndArgs);
        await window.dispatchKeybinding('enter');
    }
    async getNewWindow(existingWindow, windowId) {
        // This code accesses some private members of the `Code` class,
        // because it was not designed to support multi-window automation.
        const newWindow = new code_1.Code(existingWindow.process, existingWindow.client, existingWindow.driver, this.logger);
        newWindow._activeWindowId = windowId;
        newWindow.driver = existingWindow.driver;
        // Wait for the new window to be ready. (This code is copied from
        // Application.checkWindowReady(), which only works for the first window.)
        await newWindow.waitForElement('.monaco-workbench');
        await new Promise(c => setTimeout(c, 500));
        return newWindow;
    }
    getLiveShareCommandInfo(id) {
        const command = this.extensionInfo.contributes.commands.find((c) => c.command === id);
        assert(command && command.title && command.category, 'Expected Live Share command: ' + id);
        return command;
    }
    async runLiveShareCommand(workbench, id) {
        const command = this.getLiveShareCommandInfo(id);
        const title = command && command.title;
        const category = command && command.category;
        await workbench.quickopen.runCommand(`${category}: ${title}`);
    }
    async runLiveShareCommandIfAvailable(workbench, id) {
        const command = this.getLiveShareCommandInfo(id);
        const title = command && command.title;
        const category = command && command.category;
        await workbench.quickopen.openQuickOpen(`>${category}: ${title}`);
        const window = workbench.quickopen.code;
        await window.dispatchKeybinding('enter');
        await window.dispatchKeybinding('escape');
    }
    /**
     * Waits for a notification with text that matches a given substring or regex.
     * @returns a CSS selector for the found notification element
     */
    async waitForNotification(window, message) {
        let notificationIndex = -1;
        await window.waitForElements('.notification-list-item-message', false, (elements) => {
            notificationIndex = 0;
            for (let element of elements) {
                if (element.textContent.match(message)) {
                    return true;
                }
                notificationIndex++;
            }
            return false;
        });
        return `.notifications-toasts > div:nth-child(${notificationIndex + 1}) ` +
            '.notification-list-item';
    }
    async waitForAndClickNotificationButton(window, message, buttonText) {
        const selector = await this.waitForNotification(window, message);
        // Notifications animate in, so they can't be clicked immediately.
        await new Promise((c) => setTimeout(c, 500));
        await window.waitAndClick(`${selector} a.monaco-button[title="${buttonText}"]`);
    }
    async waitForAndDismissNotification(window, message) {
        const selector = await this.waitForNotification(window, message);
        // Notifications animate in, so they can't be clicked immediately.
        await new Promise((c) => setTimeout(c, 500));
        // Click on the notification first to ensure the focus is in the right place.
        await window.waitAndClick(selector);
        // Send the hotkey to dismiss the notification.
        await window.dispatchKeybinding(os.platform() === 'darwin' ? 'cmd+backspace' : 'delete');
    }
    /**
     * Checks if the statusbar currently contains an entry with the given title (not label).
     */
    async checkForStatusBarTitle(window, titleMatch) {
        const statusbarElements = await window.waitForElements('.statusbar-entry a', false);
        const entry = statusbarElements.find(element => {
            const title = element.attributes['title'];
            return !!(title && title.match(titleMatch));
        });
        return !!entry;
    }
    /**
     * Waits for a statusbar with the given title (not label).
     * Or specify invert=true to wait until it goes away.
     * @returns a CSS selector for the found statusbar item
     */
    async waitForStatusBarTitle(window, titleMatch, invert = false) {
        let itemIndex = -1;
        await window.waitForElements('.statusbar > div', true, (elements) => {
            itemIndex = 0;
            for (let element of elements) {
                const title = element.children && element.children[0] &&
                    element.children[0].attributes['title'];
                if (title && title.match(titleMatch)) {
                    return !invert;
                }
                itemIndex++;
            }
            return invert;
        });
        return `.statusbar > div:nth-of-type(${itemIndex + 1})`;
    }
    async waitForAndClickStatusBarTitle(window, titleMatch) {
        const selector = await this.waitForStatusBarTitle(window, titleMatch);
        await window.waitAndClick(`${selector} > a`);
    }
    async waitForDocumentTitle(window, titleMatch, invert = false) {
        await window.waitForElements('.monaco-icon-label a.label-name', false, (elements) => {
            for (let element of elements) {
                const title = element.textContent;
                if (title && title.match(titleMatch)) {
                    return !invert;
                }
            }
            return invert;
        });
    }
    async share(connectionMode) {
        this.hostWorkbench.quickopen.runCommand('Notifications: Clear All Notifications');
        await this.changeSettings({ 'liveshare.connectionMode': connectionMode || UITestSuite._defaultConnectionMode });
        await this.runLiveShareCommand(this.hostWorkbench, 'liveshare.start');
        const welcomeRegex = /vsliveshare-welcome-page/;
        const invitationRegex = /Invitation link copied/;
        const firewallRegex = /firewall.*vsls-agent/;
        // Depending on the state of the welcome page memento and firewall configuration,
        // sharing could lead to one of 3 different things. Wait for all of them simultaneously.
        let blockedByFirewall = false;
        let welcomePageShown = false;
        await this.hostWindow.waitForElements('.monaco-icon-label a.label-name, .notification-list-item-message', false, (elements) => {
            for (let element of elements) {
                if (UITestSuite._firstShare && welcomeRegex.test(element.textContent)) {
                    welcomePageShown = true;
                    return true;
                }
                else if (invitationRegex.test(element.textContent)) {
                    return true;
                }
                else if (firewallRegex.test(element.textContent)) {
                    blockedByFirewall = true;
                    return true;
                }
            }
        });
        if (blockedByFirewall) {
            // A non-automatable firewall dialog is about to be shown.
            // Abort sharing by reloading the window. Then wait for ready state.
            await this.reloadWindow(this.hostWindow);
            await new Promise((c) => setTimeout(c, 4000));
            await this.waitForStatusBarTitle(this.hostWindow, /(Start Collaboration)|(Share the workspace)/);
            if (!connectionMode) {
                // A specific connection mode was not specified.
                // So switch the default mode to relay and try again.
                UITestSuite._defaultConnectionMode = 'relay';
                return this.share(UITestSuite._defaultConnectionMode);
            }
            else {
                throw new Error(`Cannot share in ${connectionMode} mode. Blocked by firewall.`);
            }
        }
        UITestSuite._firstShare = false;
        if (!welcomePageShown) {
            await this.waitForAndDismissNotification(this.hostWindow, invitationRegex);
        }
        this.inviteUri = clipboardy_1.readSync();
        assert(this.inviteUri && this.inviteUri.startsWith(this.serviceUri), 'Invite link should have been copied to clipboard.');
    }
    async unshare() {
        await this.runLiveShareCommandIfAvailable(this.hostWorkbench, 'liveshare.end');
        await this.waitForStatusBarTitle(this.hostWindow, /(Start Collaboration)|(Share the workspace)/);
        this.inviteUri = null;
    }
    async join(connectionMode = 'auto') {
        if (!this.inviteUri) {
            throw new Error('Not in shared state.');
        }
        await this.changeSettings({ 'liveshare.connectionMode': connectionMode });
        if (!this.guestWindow) {
            this.guestWindow = await this.openGuestWindow();
            this.guestWorkbench = new workbench_1.Workbench(this.guestWindow, this.app.userDataPath);
        }
        await this.runLiveShareCommand(this.guestWorkbench, 'liveshare.join');
        await this.guestWorkbench.quickinput.waitForQuickInputOpened();
        await this.guestWindow.waitForSetValue(quickinput_1.QuickInput.QUICK_INPUT_INPUT, this.inviteUri);
        await this.guestWindow.dispatchKeybinding('enter');
        // The window should reload with collaborating status.
        // Consume some of the time here to reduce the liklihood of the next wait timing out.
        await new Promise((c) => setTimeout(c, 5000));
        await this.waitForStatusBarTitle(this.guestWindow, 'Collaborating');
    }
    async unjoin() {
        await this.runLiveShareCommandIfAvailable(this.guestWorkbench, 'liveshare.leave');
        // Wait until the window reload has surely started, to avoid
        // detecting the status before the reload.
        await new Promise((c) => setTimeout(c, 4000));
        // The guest window should reload in an unjoined state.
        await this.waitForStatusBarTitle(this.guestWindow, /(Start Collaboration)|(Share the workspace)/);
    }
    async changeSettings(settings) {
        const settingsFilePath = this.mochaContext.settingsFilePath;
        let settingsObject = JSON.parse((await util.promisify(fs.readFile)(settingsFilePath)).toString());
        for (let name in settings) {
            let value = settings[name];
            if (typeof value === 'undefined') {
                delete settingsObject[name];
            }
            else {
                settingsObject[name] = value;
            }
        }
        await util.promisify(fs.writeFile)(settingsFilePath, JSON.stringify(settingsObject, null, '\t'));
        // Allow some time for VS Code to load the changed settings.
        await new Promise((c) => setTimeout(c, 1000));
    }
}
UITestSuite._firstShare = true;
UITestSuite._defaultConnectionMode = 'direct';
__decorate([
    mocha_typescript_1.context
], UITestSuite.prototype, "mochaContext", void 0);
exports.UITestSuite = UITestSuite;

//# sourceMappingURL=uiTestSuite.js.map
