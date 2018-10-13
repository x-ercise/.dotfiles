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
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const extensionVariables_1 = require("../../extensionVariables");
const localize_1 = require("../../localize");
function confirmOverwriteSettings(sourceSettings, destinationSettings, destinationName) {
    return __awaiter(this, void 0, void 0, function* () {
        let suppressPrompt = false;
        let overwriteSetting = false;
        const addedKeys = [];
        const updatedKeys = [];
        const userIgnoredKeys = [];
        const matchingKeys = [];
        for (const key of Object.keys(sourceSettings)) {
            if (destinationSettings[key] === undefined) {
                addedKeys.push(key);
                destinationSettings[key] = sourceSettings[key];
            }
            else if (destinationSettings[key] !== sourceSettings[key]) {
                if (!suppressPrompt) {
                    const yesToAll = { title: localize_1.localize('yesToAll', 'Yes to all') };
                    const noToAll = { title: localize_1.localize('noToAll', 'No to all') };
                    const message = localize_1.localize('overwriteSetting', 'Setting "{0}" already exists in "{1}". Overwrite?', key, destinationName);
                    const result = yield extensionVariables_1.ext.ui.showWarningMessage(message, { modal: true }, vscode_azureextensionui_1.DialogResponses.yes, yesToAll, vscode_azureextensionui_1.DialogResponses.no, noToAll);
                    if (result === vscode_azureextensionui_1.DialogResponses.yes) {
                        overwriteSetting = true;
                    }
                    else if (result === yesToAll) {
                        overwriteSetting = true;
                        suppressPrompt = true;
                    }
                    else if (result === vscode_azureextensionui_1.DialogResponses.no) {
                        overwriteSetting = false;
                    }
                    else if (result === noToAll) {
                        overwriteSetting = false;
                        suppressPrompt = true;
                    }
                }
                if (overwriteSetting) {
                    updatedKeys.push(key);
                    destinationSettings[key] = sourceSettings[key];
                }
                else {
                    userIgnoredKeys.push(key);
                }
            }
            else {
                matchingKeys.push(key);
            }
        }
        if (addedKeys.length > 0) {
            extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('addedKeys', 'Added the following settings:'));
            addedKeys.forEach(logKey);
        }
        if (updatedKeys.length > 0) {
            extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('updatedKeys', 'Updated the following settings:'));
            updatedKeys.forEach(logKey);
        }
        if (matchingKeys.length > 0) {
            extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('matchingKeys', 'Ignored the following settings that were already the same:'));
            matchingKeys.forEach(logKey);
        }
        if (userIgnoredKeys.length > 0) {
            extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('userIgnoredKeys', 'Ignored the following settings based on user input:'));
            userIgnoredKeys.forEach(logKey);
        }
        if (Object.keys(destinationSettings).length > Object.keys(sourceSettings).length) {
            extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('noDeleteKey', 'WARNING: This operation will not delete any settings in "{0}". You must manually delete settings if desired.', destinationName));
        }
    });
}
exports.confirmOverwriteSettings = confirmOverwriteSettings;
function logKey(key) {
    extensionVariables_1.ext.outputChannel.appendLine(`- ${key}`);
}
//# sourceMappingURL=confirmOverwriteSettings.js.map