"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const azure_account_1 = require("./azure-account");
const telemetry_1 = require("./telemetry");
const opn = require("opn");
const nls = require("vscode-nls");
const fs_1 = require("fs");
const path_1 = require("path");
const cloudConsole_1 = require("./cloudConsole");
const nps_1 = require("./nps");
const localize = nls.loadMessageBundle();
const enableLogging = false;
function activate(context) {
    const reporter = telemetry_1.createReporter(context);
    const azureLogin = new azure_account_1.AzureLoginHelper(context, reporter);
    if (enableLogging) {
        logDiagnostics(context, azureLogin.api);
    }
    const subscriptions = context.subscriptions;
    subscriptions.push(createStatusBarItem(context, azureLogin.api));
    subscriptions.push(vscode_1.commands.registerCommand('azure-account.createAccount', createAccount));
    subscriptions.push(vscode_1.commands.registerCommand('azure-account.openCloudConsoleLinux', () => cloudConsole(azureLogin.api, 'Linux')));
    subscriptions.push(vscode_1.commands.registerCommand('azure-account.openCloudConsoleWindows', () => cloudConsole(azureLogin.api, 'Windows')));
    subscriptions.push(vscode_1.commands.registerCommand('azure-account.uploadFileCloudConsole', uri => uploadFile(azureLogin.api, uri)));
    nps_1.survey(context, reporter);
    return Promise.resolve(azureLogin.api); // Return promise to work around weird error in WinJS.
}
exports.activate = activate;
function cloudConsole(api, os) {
    const shell = api.createCloudShell(os);
    shell.terminal.then(terminal => terminal.show());
    return shell;
}
function uploadFile(api, uri) {
    (() => __awaiter(this, void 0, void 0, function* () {
        let shell = cloudConsole_1.shells[0];
        if (!shell) {
            const shellName = yield vscode_1.window.showInformationMessage(localize('azure-account.uploadingRequiresOpenCloudConsole', "File upload requires an open Cloud Shell."), cloudConsole_1.OSes.Linux.shellName, cloudConsole_1.OSes.Windows.shellName);
            if (!shellName) {
                return;
            }
            shell = cloudConsole(api, shellName === cloudConsole_1.OSes.Linux.shellName ? 'Linux' : 'Windows');
        }
        if (!uri) {
            uri = ((yield vscode_1.window.showOpenDialog({})) || [])[0];
        }
        if (uri) {
            const filename = path_1.basename(uri.fsPath);
            return vscode_1.window.withProgress({
                location: vscode_1.ProgressLocation.Notification,
                title: localize('azure-account.uploading', "Uploading '{0}'...", filename),
                cancellable: true
            }, (progress, token) => {
                return shell.uploadFile(filename, fs_1.createReadStream(uri.fsPath), { progress, token });
            });
        }
    }))()
        .catch(console.error);
}
function logDiagnostics(context, api) {
    const subscriptions = context.subscriptions;
    subscriptions.push(api.onStatusChanged(status => {
        console.log(`onStatusChanged: ${status}`);
    }));
    subscriptions.push(api.onSessionsChanged(() => {
        console.log(`onSessionsChanged: ${api.sessions.length} ${api.status}`);
    }));
    (() => __awaiter(this, void 0, void 0, function* () {
        console.log(`waitForLogin: ${yield api.waitForLogin()} ${api.status}`);
    }))().catch(console.error);
    subscriptions.push(api.onSubscriptionsChanged(() => {
        console.log(`onSubscriptionsChanged: ${api.subscriptions.length}`);
    }));
    (() => __awaiter(this, void 0, void 0, function* () {
        console.log(`waitForSubscriptions: ${yield api.waitForSubscriptions()} ${api.subscriptions.length}`);
    }))().catch(console.error);
    subscriptions.push(api.onFiltersChanged(() => {
        console.log(`onFiltersChanged: ${api.filters.length}`);
    }));
    (() => __awaiter(this, void 0, void 0, function* () {
        console.log(`waitForFilters: ${yield api.waitForFilters()} ${api.filters.length}`);
    }))().catch(console.error);
}
function createAccount() {
    opn('https://azure.microsoft.com/en-us/free/?utm_source=campaign&utm_campaign=vscode-azure-account&mktingSource=vscode-azure-account');
}
function createStatusBarItem(context, api) {
    const statusBarItem = vscode_1.window.createStatusBarItem();
    statusBarItem.command = "azure-account.selectSubscriptions";
    function updateStatusBar() {
        switch (api.status) {
            case 'LoggingIn':
                statusBarItem.text = localize('azure-account.loggingIn', "Azure: Signing in...");
                statusBarItem.show();
                break;
            case 'LoggedIn':
                if (api.sessions.length) {
                    const azureConfig = vscode_1.workspace.getConfiguration('azure');
                    const showSignedInEmail = azureConfig.get('showSignedInEmail');
                    statusBarItem.text = showSignedInEmail ? localize('azure-account.loggedIn', "Azure: {0}", api.sessions[0].userId) : localize('azure-account.loggedIn', "Azure: Signed In");
                    statusBarItem.show();
                }
                break;
            default:
                statusBarItem.hide();
                break;
        }
    }
    context.subscriptions.push(statusBarItem, api.onStatusChanged(updateStatusBar), api.onSessionsChanged(updateStatusBar), vscode_1.workspace.onDidChangeConfiguration(updateStatusBar));
    updateStatusBar();
    return statusBarItem;
}
function deactivate() {
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map