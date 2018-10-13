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
const opn = require("opn");
const vscode = require("vscode");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const extensionVariables_1 = require("../../extensionVariables");
function reportMessage(message, progress) {
    extensionVariables_1.ext.outputChannel.appendLine(message);
    progress.report({ message: message });
}
exports.reportMessage = reportMessage;
function checkForRemoteDebugSupport(siteConfig) {
    // So far only node on linux is supported
    if (!siteConfig.linuxFxVersion || !siteConfig.linuxFxVersion.toLowerCase().startsWith('node')) {
        throw new Error('Azure Remote Debugging is currently only supported for node on Linux.');
    }
}
exports.checkForRemoteDebugSupport = checkForRemoteDebugSupport;
function setRemoteDebug(isRemoteDebuggingToBeEnabled, confirmMessage, noopMessage, siteClient, siteConfig, progress) {
    return __awaiter(this, void 0, void 0, function* () {
        if (isRemoteDebuggingToBeEnabled !== siteConfig.remoteDebuggingEnabled) {
            const result = yield extensionVariables_1.ext.ui.showWarningMessage(confirmMessage, { modal: true }, vscode_azureextensionui_1.DialogResponses.yes, vscode_azureextensionui_1.DialogResponses.learnMore, vscode_azureextensionui_1.DialogResponses.cancel);
            if (result === vscode_azureextensionui_1.DialogResponses.yes) {
                siteConfig.remoteDebuggingEnabled = isRemoteDebuggingToBeEnabled;
                reportMessage('Updating site configuration to set remote debugging...', progress);
                yield vscode_azureextensionui_1.callWithTelemetryAndErrorHandling('appService.remoteDebugUpdateConfiguration', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        this.suppressErrorDisplay = true;
                        this.rethrowError = true;
                        yield siteClient.updateConfiguration(siteConfig);
                    });
                });
                reportMessage('Updating site configuration done...', progress);
            }
            else if (result === vscode_azureextensionui_1.DialogResponses.learnMore) {
                // tslint:disable-next-line:no-unsafe-any
                opn('https://aka.ms/appsvc-remotedebug');
            }
            else {
                // User canceled
                return;
            }
        }
        else {
            // Update not needed
            if (noopMessage) {
                vscode.window.showWarningMessage(noopMessage);
            }
        }
    });
}
exports.setRemoteDebug = setRemoteDebug;
//# sourceMappingURL=remoteDebugCommon.js.map