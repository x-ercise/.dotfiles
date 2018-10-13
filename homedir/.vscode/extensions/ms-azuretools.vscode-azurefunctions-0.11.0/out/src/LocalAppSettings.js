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
const fse = require("fs-extra");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const constants_1 = require("./constants");
const errors_1 = require("./errors");
const extensionVariables_1 = require("./extensionVariables");
const localize_1 = require("./localize");
const IFunctionSetting_1 = require("./templates/IFunctionSetting");
const azUtil = require("./utils/azure");
const fsUtil = require("./utils/fs");
exports.azureWebJobsStorageKey = 'AzureWebJobsStorage';
function promptForAppSetting(actionContext, localSettingsPath, resourceType) {
    return __awaiter(this, void 0, void 0, function* () {
        const settings = yield getLocalSettings(localSettingsPath);
        const resourceTypeLabel = IFunctionSetting_1.getResourceTypeLabel(resourceType);
        if (settings.Values) {
            const existingSettings = Object.keys(settings.Values);
            if (existingSettings.length !== 0) {
                let picks = [{ data: true /* createNewAppSetting */, label: localize_1.localize('azFunc.newAppSetting', '$(plus) New App Setting'), description: '' }];
                picks = picks.concat(existingSettings.map((s) => { return { data: false /* createNewAppSetting */, label: s, description: '' }; }));
                const options = { placeHolder: localize_1.localize('azFunc.selectAppSetting', 'Select an App Setting for your \'{0}\'', resourceTypeLabel) };
                const result = yield extensionVariables_1.ext.ui.showQuickPick(picks, options);
                if (!result.data /* createNewAppSetting */) {
                    return result.label;
                }
            }
        }
        let resourceResult;
        try {
            switch (resourceType) {
                case IFunctionSetting_1.ResourceType.DocumentDB:
                    resourceResult = yield azUtil.promptForCosmosDBAccount();
                    break;
                case IFunctionSetting_1.ResourceType.Storage:
                    resourceResult = yield azUtil.promptForStorageAccount(actionContext, {
                        kind: [
                            vscode_azureextensionui_1.StorageAccountKind.BlobStorage
                        ],
                        learnMoreLink: 'https://aka.ms/T5o0nf'
                    });
                    break;
                case IFunctionSetting_1.ResourceType.ServiceBus:
                    resourceResult = yield azUtil.promptForServiceBus();
                    break;
                default:
            }
        }
        catch (error) {
            if (error instanceof errors_1.NoSubscriptionError) {
                // swallow error and prompt for connection string instead
            }
            else {
                throw error;
            }
        }
        const appSettingSuffix = `_${resourceType.toUpperCase()}`;
        let appSettingKey;
        let connectionString;
        if (resourceResult) {
            appSettingKey = `${resourceResult.name}${appSettingSuffix}`;
            connectionString = resourceResult.connectionString;
        }
        else {
            const keyOptions = {
                placeHolder: localize_1.localize('azFunc.AppSettingKeyPlaceholder', '\'{0}\' App Setting Key', resourceTypeLabel),
                prompt: localize_1.localize('azFunc.AppSettingKeyPrompt', 'Enter a key for your \'{0}\' connection string', resourceTypeLabel),
                value: `example${appSettingSuffix}`
            };
            appSettingKey = yield extensionVariables_1.ext.ui.showInputBox(keyOptions);
            const valueOptions = {
                placeHolder: localize_1.localize('azFunc.AppSettingValuePlaceholder', '\'{0}\' App Setting Value', resourceTypeLabel),
                prompt: localize_1.localize('azFunc.AppSettingValuePrompt', 'Enter the connection string for your \'{0}\'', resourceTypeLabel)
            };
            connectionString = yield extensionVariables_1.ext.ui.showInputBox(valueOptions);
        }
        yield setAppSetting(settings, localSettingsPath, appSettingKey, connectionString);
        return appSettingKey;
    });
}
exports.promptForAppSetting = promptForAppSetting;
function validateAzureWebJobsStorage(actionContext, localSettingsPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const settings = yield getLocalSettings(localSettingsPath);
        if (settings.Values && settings.Values[exports.azureWebJobsStorageKey]) {
            return;
        }
        const message = localize_1.localize('azFunc.AzureWebJobsStorageWarning', 'All non-HTTP triggers require AzureWebJobsStorage to be set in \'{0}\' for local debugging.', constants_1.localSettingsFileName);
        const selectStorageAccount = { title: localize_1.localize('azFunc.SelectStorageAccount', 'Select Storage Account') };
        const result = yield extensionVariables_1.ext.ui.showWarningMessage(message, selectStorageAccount, vscode_azureextensionui_1.DialogResponses.skipForNow);
        if (result === selectStorageAccount) {
            let connectionString;
            try {
                const resourceResult = yield azUtil.promptForStorageAccount(actionContext, {
                    kind: [
                        vscode_azureextensionui_1.StorageAccountKind.BlobStorage
                    ],
                    performance: [
                        vscode_azureextensionui_1.StorageAccountPerformance.Premium
                    ],
                    replication: [
                        vscode_azureextensionui_1.StorageAccountReplication.ZRS
                    ],
                    learnMoreLink: 'https://aka.ms/Cfqnrc'
                });
                connectionString = resourceResult.connectionString;
            }
            catch (error) {
                if (error instanceof errors_1.NoSubscriptionError) {
                    const options = {
                        placeHolder: localize_1.localize('azFunc.StoragePlaceholder', '\'{0}\' Connection String', exports.azureWebJobsStorageKey),
                        prompt: localize_1.localize('azFunc.StoragePrompt', 'Enter the connection string for your \'{0}\'', exports.azureWebJobsStorageKey)
                    };
                    connectionString = yield extensionVariables_1.ext.ui.showInputBox(options);
                }
                else {
                    throw error;
                }
            }
            yield setAppSetting(settings, localSettingsPath, exports.azureWebJobsStorageKey, connectionString);
        }
    });
}
exports.validateAzureWebJobsStorage = validateAzureWebJobsStorage;
function setAppSetting(settings, localSettingsPath, key, value) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!settings.Values) {
            settings.Values = {};
        }
        if (settings.Values[key]) {
            const message = localize_1.localize('azFunc.SettingAlreadyExists', 'Local app setting \'{0}\' already exists. Overwrite?', key);
            if ((yield extensionVariables_1.ext.ui.showWarningMessage(message, { modal: true }, vscode_azureextensionui_1.DialogResponses.yes, vscode_azureextensionui_1.DialogResponses.cancel)) !== vscode_azureextensionui_1.DialogResponses.yes) {
                return;
            }
        }
        settings.Values[key] = value;
        yield fsUtil.writeFormattedJson(localSettingsPath, settings);
    });
}
function getLocalSettings(localSettingsPath) {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield fse.pathExists(localSettingsPath)) {
            const data = (yield fse.readFile(localSettingsPath)).toString();
            if (/[^\s]/.test(data)) {
                return JSON.parse(data);
            }
        }
        return {
            IsEncrypted: false,
            Values: {}
        };
    });
}
exports.getLocalSettings = getLocalSettings;
//# sourceMappingURL=LocalAppSettings.js.map