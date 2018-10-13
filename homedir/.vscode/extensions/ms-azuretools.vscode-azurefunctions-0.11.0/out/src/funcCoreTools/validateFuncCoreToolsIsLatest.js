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
// tslint:disable-next-line:no-require-imports
const request = require("request-promise");
const semver = require("semver");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const constants_1 = require("../constants");
const extensionVariables_1 = require("../extensionVariables");
const localize_1 = require("../localize");
const ProjectSettings_1 = require("../ProjectSettings");
const getFuncPackageManager_1 = require("./getFuncPackageManager");
const getLocalFuncCoreToolsVersion_1 = require("./getLocalFuncCoreToolsVersion");
const getNpmDistTag_1 = require("./getNpmDistTag");
const updateFuncCoreTools_1 = require("./updateFuncCoreTools");
function validateFuncCoreToolsIsLatest() {
    return __awaiter(this, void 0, void 0, function* () {
        yield vscode_azureextensionui_1.callWithTelemetryAndErrorHandling('azureFunctions.validateFuncCoreToolsIsLatest', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.suppressErrorDisplay = true;
                this.properties.isActivationEvent = 'true';
                const settingKey = 'showCoreToolsWarning';
                if (ProjectSettings_1.getFuncExtensionSetting(settingKey)) {
                    const localVersion = yield getLocalFuncCoreToolsVersion_1.getLocalFuncCoreToolsVersion();
                    if (!localVersion) {
                        return;
                    }
                    this.properties.localVersion = localVersion;
                    const projectRuntime = ProjectSettings_1.convertStringToRuntime(localVersion);
                    if (projectRuntime === undefined) {
                        return;
                    }
                    const packageManager = yield getFuncPackageManager_1.getFuncPackageManager(true /* isFuncInstalled */);
                    const newestVersion = yield getNewestFunctionRuntimeVersion(packageManager, projectRuntime, this);
                    if (!newestVersion) {
                        return;
                    }
                    if (semver.gt(newestVersion, localVersion)) {
                        const message = localize_1.localize('azFunc.outdatedFunctionRuntime', 'Update your Azure Functions Core Tools ({0}) to the latest ({1}) for the best experience.', localVersion, newestVersion);
                        const update = { title: 'Update' };
                        let result;
                        do {
                            result = packageManager !== undefined ? yield extensionVariables_1.ext.ui.showWarningMessage(message, update, vscode_azureextensionui_1.DialogResponses.learnMore, vscode_azureextensionui_1.DialogResponses.dontWarnAgain) :
                                yield extensionVariables_1.ext.ui.showWarningMessage(message, vscode_azureextensionui_1.DialogResponses.learnMore, vscode_azureextensionui_1.DialogResponses.dontWarnAgain);
                            if (result === vscode_azureextensionui_1.DialogResponses.learnMore) {
                                yield opn('https://aka.ms/azFuncOutdated');
                            }
                            else if (result === update) {
                                // tslint:disable-next-line:no-non-null-assertion
                                yield updateFuncCoreTools_1.updateFuncCoreTools(packageManager, projectRuntime);
                            }
                            else if (result === vscode_azureextensionui_1.DialogResponses.dontWarnAgain) {
                                yield ProjectSettings_1.updateGlobalSetting(settingKey, false);
                            }
                        } while (result === vscode_azureextensionui_1.DialogResponses.learnMore);
                    }
                }
            });
        });
    });
}
exports.validateFuncCoreToolsIsLatest = validateFuncCoreToolsIsLatest;
function getNewestFunctionRuntimeVersion(packageManager, projectRuntime, actionContext) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (packageManager === constants_1.PackageManager.brew) {
                const brewRegistryUri = 'https://aka.ms/AA1t7go';
                const brewInfo = yield request(brewRegistryUri);
                const matches = brewInfo.match(/version\s+["']([^"']+)["']/i);
                if (matches && matches.length > 1) {
                    return matches[1];
                }
            }
            else {
                return (yield getNpmDistTag_1.getNpmDistTag(projectRuntime)).value;
            }
        }
        catch (error) {
            actionContext.properties.latestRuntimeError = vscode_azureextensionui_1.parseError(error).message;
        }
        return undefined;
    });
}
//# sourceMappingURL=validateFuncCoreToolsIsLatest.js.map