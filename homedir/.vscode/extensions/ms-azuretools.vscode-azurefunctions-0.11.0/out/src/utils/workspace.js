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
const util_1 = require("util");
const vscode = require("vscode");
const extensionVariables_1 = require("../extensionVariables");
const localize_1 = require("../localize");
const ProjectSettings_1 = require("../ProjectSettings");
const fsUtils = require("./fs");
function selectWorkspaceFolder(ui, placeHolder, getSubPath) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield selectWorkspaceItem(ui, placeHolder, {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 ? vscode.workspace.workspaceFolders[0].uri : undefined,
            openLabel: localize_1.localize('select', 'Select')
        }, getSubPath);
    });
}
exports.selectWorkspaceFolder = selectWorkspaceFolder;
function selectWorkspaceFile(ui, placeHolder, getSubPath) {
    return __awaiter(this, void 0, void 0, function* () {
        let defaultUri;
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 && getSubPath) {
            const firstFolder = vscode.workspace.workspaceFolders[0];
            const subPath = getSubPath(firstFolder);
            if (subPath) {
                defaultUri = vscode.Uri.file(path.join(firstFolder.uri.fsPath, subPath));
            }
        }
        return yield selectWorkspaceItem(ui, placeHolder, {
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            defaultUri: defaultUri,
            openLabel: localize_1.localize('select', 'Select')
        }, getSubPath);
    });
}
exports.selectWorkspaceFile = selectWorkspaceFile;
function selectWorkspaceItem(ui, placeHolder, options, getSubPath) {
    return __awaiter(this, void 0, void 0, function* () {
        let folder;
        if (vscode.workspace.workspaceFolders) {
            const folderPicks = vscode.workspace.workspaceFolders.map((f) => {
                let subpath;
                if (getSubPath) {
                    subpath = getSubPath(f);
                }
                const fsPath = subpath ? path.join(f.uri.fsPath, subpath) : f.uri.fsPath;
                return { label: path.basename(fsPath), description: fsPath, data: fsPath };
            });
            folderPicks.push({ label: localize_1.localize('azFunc.browse', '$(file-directory) Browse...'), description: '', data: undefined });
            folder = yield ui.showQuickPick(folderPicks, { placeHolder });
        }
        return folder && folder.data ? folder.data : (yield ui.showOpenDialog(options))[0].fsPath;
    });
}
exports.selectWorkspaceItem = selectWorkspaceItem;
var OpenBehavior;
(function (OpenBehavior) {
    OpenBehavior["AddToWorkspace"] = "AddToWorkspace";
    OpenBehavior["OpenInNewWindow"] = "OpenInNewWindow";
    OpenBehavior["OpenInCurrentWindow"] = "OpenInCurrentWindow";
})(OpenBehavior || (OpenBehavior = {}));
const projectOpenBehaviorSetting = 'projectOpenBehavior';
/**
 * If the selected folder is not open in a workspace, open it now. NOTE: This may restart the extension host
 */
function ensureFolderIsOpen(fsPath, actionContext, message, allowSubFolder = false) {
    return __awaiter(this, void 0, void 0, function* () {
        // tslint:disable-next-line:strict-boolean-expressions
        const openFolders = vscode.workspace.workspaceFolders || [];
        const folder = openFolders.find((f) => {
            return fsUtils.isPathEqual(f.uri.fsPath, fsPath) || (allowSubFolder && fsUtils.isSubpath(f.uri.fsPath, fsPath));
        });
        if (folder) {
            actionContext.properties.openBehavior = 'AlreadyOpen';
        }
        else {
            if (message) {
                const open = { title: localize_1.localize('open', 'Open Folder') };
                // No need to check result. Open/Cancel are the only possibilities and Cancel will throw a UserCancelledError
                yield extensionVariables_1.ext.ui.showWarningMessage(message, { modal: true }, open);
            }
            actionContext.properties.openBehaviorFromSetting = 'false';
            const setting = ProjectSettings_1.getFuncExtensionSetting(projectOpenBehaviorSetting);
            let openBehavior;
            if (setting) {
                for (const key of Object.keys(OpenBehavior)) {
                    const value = OpenBehavior[key];
                    if (value.toLowerCase() === setting.toLowerCase()) {
                        openBehavior = value;
                        actionContext.properties.openBehaviorFromSetting = 'true';
                        break;
                    }
                }
            }
            const notAlwaysPick = { label: localize_1.localize('notAlways', '$(circle-slash) Always use this choice'), description: '', data: false, suppressPersistence: true };
            const alwaysPick = { label: localize_1.localize('always', '$(check) Always use this choice'), description: '', data: true, suppressPersistence: true };
            const picks = [
                { label: localize_1.localize('AddToWorkspace', 'Add to workspace'), description: '', data: OpenBehavior.AddToWorkspace },
                { label: localize_1.localize('OpenInNewWindow', 'Open in new window'), description: '', data: OpenBehavior.OpenInNewWindow },
                { label: localize_1.localize('OpenInCurrentWindow', 'Open in current window'), description: '', data: OpenBehavior.OpenInCurrentWindow },
                notAlwaysPick
            ];
            const options = { placeHolder: localize_1.localize('selectOpenBehavior', 'Select how you would like to open your project'), suppressPersistence: true };
            let result;
            let alwaysUseThisChoice = false;
            while (openBehavior === undefined) {
                result = (yield extensionVariables_1.ext.ui.showQuickPick(picks, options)).data;
                if (util_1.isBoolean(result)) {
                    alwaysUseThisChoice = !result; // The new value is the opposite of what the user just clicked in the quick pick
                    picks.pop();
                    picks.push(alwaysUseThisChoice ? alwaysPick : notAlwaysPick);
                }
                else {
                    openBehavior = result;
                }
            }
            actionContext.properties.openBehavior = openBehavior;
            if (alwaysUseThisChoice) {
                yield ProjectSettings_1.updateGlobalSetting(projectOpenBehaviorSetting, openBehavior);
            }
            const uri = vscode.Uri.file(fsPath);
            if (openBehavior === OpenBehavior.AddToWorkspace) {
                vscode.workspace.updateWorkspaceFolders(openFolders.length, 0, { uri: uri });
            }
            else {
                yield vscode.commands.executeCommand('vscode.openFolder', uri, openBehavior === OpenBehavior.OpenInNewWindow /* forceNewWindow */);
            }
            if (message) {
                // After we've opened the folder, throw the error message for the sake of telemetry
                actionContext.suppressErrorDisplay = true;
                throw new Error(message);
            }
        }
    });
}
exports.ensureFolderIsOpen = ensureFolderIsOpen;
//# sourceMappingURL=workspace.js.map