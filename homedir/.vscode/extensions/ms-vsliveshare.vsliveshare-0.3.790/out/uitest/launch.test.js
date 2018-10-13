"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const rimraf = require("rimraf");
const mocha_typescript_1 = require("mocha-typescript");
const uiTestSuite_1 = require("./uiTestSuite");
let LaunchTests = class LaunchTests extends uiTestSuite_1.UITestSuite {
    async launch() {
        // Delete install.Lock to trigger the dependency check.
        rimraf.sync(path.join(this.extensionDir, 'install.Lock'));
        // Uncomment this line to cause .NET Core to be downloaded.
        //rimraf.sync(path.join(extensionDir, 'dotnet_modules', 'mscorlib.dll'));
        await this.app.start();
        this.hostWindow = this.app.code;
        this.hostWorkbench = this.app.workbench;
    }
    async dependenciesInstalledNotification() {
        await this.waitForAndDismissNotification(this.hostWindow, 'VS Live Share installed!');
    }
    async shareButtonOnStatusBar() {
        await this.waitForStatusBarTitle(this.hostWindow, /(Start Collaboration)|(Share the workspace)/);
    }
    async shareTabOnActivityBar() {
        const title = this.extensionInfo.contributes.viewsContainers.activitybar[0].title;
        await this.hostWindow.waitForElement(`.monaco-action-bar .action-item[title="${title}"]`);
    }
};
__decorate([
    mocha_typescript_1.test
], LaunchTests.prototype, "launch", null);
__decorate([
    mocha_typescript_1.test(mocha_typescript_1.slow(30000), mocha_typescript_1.timeout(120000))
], LaunchTests.prototype, "dependenciesInstalledNotification", null);
__decorate([
    mocha_typescript_1.test
], LaunchTests.prototype, "shareButtonOnStatusBar", null);
__decorate([
    mocha_typescript_1.test
], LaunchTests.prototype, "shareTabOnActivityBar", null);
LaunchTests = __decorate([
    mocha_typescript_1.suite
], LaunchTests);
exports.LaunchTests = LaunchTests;

//# sourceMappingURL=launch.test.js.map
