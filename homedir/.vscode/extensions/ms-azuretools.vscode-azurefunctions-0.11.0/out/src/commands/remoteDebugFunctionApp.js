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
// tslint:disable-next-line:no-require-imports
const opn = require("opn");
const portfinder = require("portfinder");
const vscode = require("vscode");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const DebugProxy_1 = require("../DebugProxy");
const localize_1 = require("../localize");
const FunctionAppTreeItem_1 = require("../tree/FunctionAppTreeItem");
const HTTP_PLATFORM_DEBUG_PORT = '8898';
const JAVA_OPTS = `-Djava.net.preferIPv4Stack=true -Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=127.0.0.1:${HTTP_PLATFORM_DEBUG_PORT}`;
function remoteDebugFunctionApp(outputChannel, ui, tree, node) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = (yield tree.showNodePicker(FunctionAppTreeItem_1.FunctionAppTreeItem.contextValue));
        }
        const client = node.treeItem.client;
        const portNumber = yield portfinder.getPortPromise();
        const publishCredential = yield client.getWebAppPublishCredential();
        const debugProxy = new DebugProxy_1.DebugProxy(outputChannel, client, portNumber, publishCredential);
        debugProxy.on('error', (err) => {
            debugProxy.dispose();
            throw err;
        });
        yield vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, (p) => __awaiter(this, void 0, void 0, function* () {
            // tslint:disable-next-line:no-any
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const siteConfig = yield client.getSiteConfig();
                    const appSettings = yield client.listApplicationSettings();
                    if (needUpdateSiteConfig(siteConfig) || (appSettings.properties && needUpdateAppSettings(appSettings.properties))) {
                        const confirmMsg = localize_1.localize('azFunc.confirmRemoteDebug', 'The configurations of the selected app will be changed before debugging. Would you like to continue?');
                        const result = yield ui.showWarningMessage(confirmMsg, { modal: true }, vscode_azureextensionui_1.DialogResponses.yes, vscode_azureextensionui_1.DialogResponses.learnMore, vscode_azureextensionui_1.DialogResponses.cancel);
                        if (result === vscode_azureextensionui_1.DialogResponses.learnMore) {
                            yield opn('https://aka.ms/azfunc-remotedebug');
                            return;
                        }
                        else {
                            yield updateSiteConfig(outputChannel, client, p, siteConfig);
                            yield updateAppSettings(outputChannel, client, p, appSettings);
                        }
                    }
                    p.report({ message: 'starting debug proxy...' });
                    outputChannel.appendLine('starting debug proxy...');
                    // tslint:disable-next-line:no-floating-promises
                    debugProxy.startProxy();
                    debugProxy.on('start', resolve);
                }
                catch (error) {
                    reject(error);
                }
            }));
        }));
        const sessionId = Date.now().toString();
        yield vscode.debug.startDebugging(undefined, {
            name: sessionId,
            type: 'java',
            request: 'attach',
            hostName: 'localhost',
            port: portNumber
        });
        const terminateDebugListener = vscode.debug.onDidTerminateDebugSession((event) => {
            if (event.name === sessionId) {
                if (debugProxy !== undefined) {
                    debugProxy.dispose();
                }
                terminateDebugListener.dispose();
            }
        });
    });
}
exports.remoteDebugFunctionApp = remoteDebugFunctionApp;
function updateSiteConfig(outputChannel, client, p, siteConfig) {
    return __awaiter(this, void 0, void 0, function* () {
        p.report({ message: 'Fetching site configuration...' });
        outputChannel.appendLine('Fetching site configuration...');
        if (needUpdateSiteConfig(siteConfig)) {
            siteConfig.use32BitWorkerProcess = false;
            siteConfig.webSocketsEnabled = true;
            p.report({ message: 'Updating site configuration to enable remote debugging...' });
            outputChannel.appendLine('Updating site configuration to enable remote debugging...');
            yield client.updateConfiguration(siteConfig);
            p.report({ message: 'Updating site configuration done...' });
            outputChannel.appendLine('Updating site configuration done...');
        }
    });
}
function updateAppSettings(outputChannel, client, p, appSettings) {
    return __awaiter(this, void 0, void 0, function* () {
        p.report({ message: 'Fetching application settings...' });
        outputChannel.appendLine('Fetching application settings...');
        if (appSettings.properties && needUpdateAppSettings(appSettings.properties)) {
            appSettings.properties.JAVA_OPTS = JAVA_OPTS;
            appSettings.properties.HTTP_PLATFORM_DEBUG_PORT = HTTP_PLATFORM_DEBUG_PORT;
            p.report({ message: 'Updating application settings to enable remote debugging...' });
            outputChannel.appendLine('Updating application settings to enable remote debugging...');
            yield client.updateApplicationSettings(appSettings);
            p.report({ message: 'Updating application settings done...' });
            outputChannel.appendLine('Updating application settings done...');
        }
    });
}
function needUpdateSiteConfig(siteConfig) {
    return siteConfig.use32BitWorkerProcess || !siteConfig.webSocketsEnabled;
}
function needUpdateAppSettings(properties) {
    // tslint:disable-next-line:no-string-literal
    return properties['JAVA_OPTS'] !== JAVA_OPTS || properties['HTTP_PLATFORM_DEBUG_PORT'] !== HTTP_PLATFORM_DEBUG_PORT;
}
//# sourceMappingURL=remoteDebugFunctionApp.js.map