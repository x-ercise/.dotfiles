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
const path = require("path");
const vscode = require("vscode");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const constants_1 = require("./constants");
const extensionVariables_1 = require("./extensionVariables");
// Resource ID
function parseAzureResourceId(resourceId) {
    const invalidIdErr = new Error('Invalid web app ID.');
    const result = {};
    if (!resourceId || resourceId.length < 2 || resourceId.charAt(0) !== '/') {
        throw invalidIdErr;
    }
    const parts = resourceId.substring(1).split('/');
    if (parts.length % 2 !== 0) {
        throw invalidIdErr;
    }
    for (let i = 0; i < parts.length; i += 2) {
        const key = parts[i];
        const value = parts[i + 1];
        if (key === '' || value === '') {
            throw invalidIdErr;
        }
        result[key] = value;
    }
    return result;
}
exports.parseAzureResourceId = parseAzureResourceId;
function showWorkspaceFoldersQuickPick(placeHolderString, telemetryProperties, subPathSetting) {
    return __awaiter(this, void 0, void 0, function* () {
        const folderQuickPickItems = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.map((value) => {
            {
                let fsPath = value.uri.fsPath;
                if (subPathSetting) {
                    const subpath = vscode.workspace.getConfiguration(constants_1.extensionPrefix, value.uri).get(subPathSetting);
                    if (subpath) {
                        fsPath = path.join(fsPath, subpath);
                    }
                }
                return {
                    label: path.basename(fsPath),
                    description: fsPath,
                    data: fsPath
                };
            }
        }) : [];
        folderQuickPickItems.push({ label: '$(file-directory) Browse...', description: '', data: undefined });
        const folderQuickPickOption = { placeHolder: placeHolderString };
        telemetryProperties.cancelStep = 'showWorkspaceFolders';
        const pickedItem = yield extensionVariables_1.ext.ui.showQuickPick(folderQuickPickItems, folderQuickPickOption);
        telemetryProperties.cancelStep = '';
        if (!pickedItem.data) {
            const browseResult = yield vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                defaultUri: vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined
            });
            if (!browseResult) {
                telemetryProperties.cancelStep = 'showWorkspaceFoldersBrowse';
                throw new vscode_azureextensionui_1.UserCancelledError();
            }
            return browseResult[0].fsPath;
        }
        else {
            return pickedItem.data;
        }
    });
}
exports.showWorkspaceFoldersQuickPick = showWorkspaceFoldersQuickPick;
function showQuickPickByFileExtension(telemetryProperties, placeHolderString, fileExtension = '*') {
    return __awaiter(this, void 0, void 0, function* () {
        const files = yield vscode.workspace.findFiles(`**/*.${fileExtension}`);
        const quickPickItems = files.map((uri) => {
            return {
                label: path.basename(uri.fsPath),
                description: uri.fsPath,
                data: uri.fsPath
            };
        });
        quickPickItems.push({ label: '$(package) Browse...', description: '', data: undefined });
        const quickPickOption = { placeHolder: placeHolderString };
        const pickedItem = yield vscode.window.showQuickPick(quickPickItems, quickPickOption);
        if (!pickedItem) {
            telemetryProperties.cancelStep = `show${fileExtension}`;
            throw new vscode_azureextensionui_1.UserCancelledError();
        }
        else if (!pickedItem.data) {
            const browseResult = yield vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                defaultUri: vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined,
                filters: { Artifacts: [fileExtension] }
            });
            if (!browseResult) {
                telemetryProperties.cancelStep = `show${fileExtension}Browse`;
                throw new vscode_azureextensionui_1.UserCancelledError();
            }
            return browseResult[0].fsPath;
        }
        else {
            return pickedItem.data;
        }
    });
}
exports.showQuickPickByFileExtension = showQuickPickByFileExtension;
//# sourceMappingURL=util.js.map