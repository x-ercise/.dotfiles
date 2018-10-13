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
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const extensionVariables_1 = require("../extensionVariables");
const localize_1 = require("../localize");
const ProjectSettings_1 = require("../ProjectSettings");
const cpUtils_1 = require("../utils/cpUtils");
const getFuncPackageManager_1 = require("./getFuncPackageManager");
const installFuncCoreTools_1 = require("./installFuncCoreTools");
function validateFuncCoreToolsInstalled(forcePrompt = false, customMessage) {
    return __awaiter(this, void 0, void 0, function* () {
        let input;
        let installed = false;
        const install = { title: localize_1.localize('install', 'Install') };
        yield vscode_azureextensionui_1.callWithTelemetryAndErrorHandling('azureFunctions.validateFuncCoreToolsInstalled', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.suppressErrorDisplay = true;
                this.properties.forcePrompt = String(forcePrompt);
                const settingKey = 'showFuncInstallation';
                if (forcePrompt || ProjectSettings_1.getFuncExtensionSetting(settingKey)) {
                    if (yield funcToolsInstalled()) {
                        installed = true;
                    }
                    else {
                        const items = [];
                        const message = customMessage ? customMessage : localize_1.localize('installFuncTools', 'You must have the Azure Functions Core Tools installed to debug your local functions.');
                        const packageManager = yield getFuncPackageManager_1.getFuncPackageManager(false /* isFuncInstalled */);
                        if (packageManager !== undefined) {
                            items.push(install);
                            if (!forcePrompt) {
                                items.push(vscode_azureextensionui_1.DialogResponses.skipForNow);
                            }
                            else {
                                items.push(vscode_azureextensionui_1.DialogResponses.cancel);
                            }
                        }
                        else {
                            items.push(vscode_azureextensionui_1.DialogResponses.learnMore);
                        }
                        if (!forcePrompt) {
                            items.push(vscode_azureextensionui_1.DialogResponses.dontWarnAgain);
                        }
                        if (forcePrompt) {
                            // See issue: https://github.com/Microsoft/vscode-azurefunctions/issues/535
                            input = yield extensionVariables_1.ext.ui.showWarningMessage(message, { modal: true }, ...items);
                        }
                        else {
                            input = yield extensionVariables_1.ext.ui.showWarningMessage(message, ...items);
                        }
                        this.properties.dialogResult = input.title;
                        if (input === install) {
                            // tslint:disable-next-line:no-non-null-assertion
                            yield installFuncCoreTools_1.installFuncCoreTools(packageManager);
                            installed = true;
                        }
                        else if (input === vscode_azureextensionui_1.DialogResponses.dontWarnAgain) {
                            yield ProjectSettings_1.updateGlobalSetting(settingKey, false);
                        }
                        else if (input === vscode_azureextensionui_1.DialogResponses.learnMore) {
                            yield opn('https://aka.ms/Dqur4e');
                        }
                    }
                }
            });
        });
        // validate that Func Tools was installed only if user confirmed
        if (input === install && !installed) {
            if ((yield extensionVariables_1.ext.ui.showWarningMessage(localize_1.localize('failedInstallFuncTools', 'The Azure Functions Core Tools installion has failed and will have to be installed manually.'), vscode_azureextensionui_1.DialogResponses.learnMore)) === vscode_azureextensionui_1.DialogResponses.learnMore) {
                yield opn('https://aka.ms/Dqur4e');
            }
        }
        return installed;
    });
}
exports.validateFuncCoreToolsInstalled = validateFuncCoreToolsInstalled;
function funcToolsInstalled() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield cpUtils_1.cpUtils.executeCommand(undefined, undefined, 'func', '--version');
            return true;
        }
        catch (error) {
            return false;
        }
    });
}
exports.funcToolsInstalled = funcToolsInstalled;
//# sourceMappingURL=validateFuncCoreToolsInstalled.js.map