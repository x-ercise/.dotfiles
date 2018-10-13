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
const portfinder = require("portfinder");
const vscode = require("vscode");
const vscode_azureappservice_1 = require("vscode-azureappservice");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const WebAppTreeItem_1 = require("../../explorer/WebAppTreeItem");
const extensionVariables_1 = require("../../extensionVariables");
const remoteDebug = require("./remoteDebugCommon");
function startRemoteDebug(node) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = (yield extensionVariables_1.ext.tree.showNodePicker(WebAppTreeItem_1.WebAppTreeItem.contextValue));
        }
        const siteClient = node.treeItem.client;
        yield vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, (progress) => __awaiter(this, void 0, void 0, function* () {
            remoteDebug.reportMessage('Fetching site configuration...', progress);
            const siteConfig = yield siteClient.getSiteConfig();
            remoteDebug.checkForRemoteDebugSupport(siteConfig);
            const debugConfig = yield getDebugConfiguration();
            // tslint:disable-next-line:no-unsafe-any
            const portNumber = debugConfig.port;
            remoteDebug.reportMessage('Checking app settings...', progress);
            const confirmEnableMessage = 'The app configuration will be updated to enable remote debugging and restarted. Would you like to continue?';
            yield remoteDebug.setRemoteDebug(true, confirmEnableMessage, undefined, siteClient, siteConfig, progress);
            remoteDebug.reportMessage('Starting tunnel proxy...', progress);
            const publishCredential = yield siteClient.getWebAppPublishCredential();
            const tunnelProxy = new vscode_azureappservice_1.TunnelProxy(portNumber, siteClient, publishCredential);
            yield vscode_azureextensionui_1.callWithTelemetryAndErrorHandling('appService.remoteDebugStartProxy', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    this.suppressErrorDisplay = true;
                    this.rethrowError = true;
                    yield tunnelProxy.startProxy();
                });
            });
            remoteDebug.reportMessage('Attaching debugger...', progress);
            yield vscode_azureextensionui_1.callWithTelemetryAndErrorHandling('appService.remoteDebugAttach', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    this.suppressErrorDisplay = true;
                    this.rethrowError = true;
                    yield vscode.debug.startDebugging(undefined, debugConfig);
                });
            });
            remoteDebug.reportMessage('Attached!', progress);
            const terminateDebugListener = vscode.debug.onDidTerminateDebugSession((event) => __awaiter(this, void 0, void 0, function* () {
                if (event.name === debugConfig.name) {
                    if (tunnelProxy !== undefined) {
                        tunnelProxy.dispose();
                    }
                    terminateDebugListener.dispose();
                    const confirmDisableMessage = 'Leaving the app in debugging mode may cause performance issues. Would you like to disable debugging for this app? The app will be restarted.';
                    yield vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, (innerProgress) => __awaiter(this, void 0, void 0, function* () {
                        yield remoteDebug.setRemoteDebug(false, confirmDisableMessage, undefined, siteClient, siteConfig, innerProgress);
                    }));
                }
            }));
        }));
    });
}
exports.startRemoteDebug = startRemoteDebug;
function getDebugConfiguration() {
    return __awaiter(this, void 0, void 0, function* () {
        const sessionId = Date.now().toString();
        const portNumber = yield portfinder.getPortPromise();
        // So far only node is supported
        const config = {
            // return {
            name: sessionId,
            type: 'node',
            protocol: 'inspector',
            request: 'attach',
            address: 'localhost',
            port: portNumber
        };
        // Try to map workspace folder source files to the remote instance
        if (vscode.workspace.workspaceFolders) {
            if (vscode.workspace.workspaceFolders.length === 1) {
                config.localRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
                config.remoteRoot = '/home/site/wwwroot';
            }
            else {
                // In this case we don't know which folder to use. Show a warning and proceed.
                // In the future we should allow users to choose a workspace folder to map sources from.
                // tslint:disable-next-line:no-floating-promises
                extensionVariables_1.ext.ui.showWarningMessage('Unable to bind breakpoints from workspace when multiple folders are open. Use "loaded scripts" instead.');
            }
        }
        else {
            // vscode will throw an error if you try to start debugging without any workspace folder open
            throw new Error("Please open a workspace folder before attaching a debugger.");
        }
        return config;
    });
}
//# sourceMappingURL=startRemoteDebug.js.map