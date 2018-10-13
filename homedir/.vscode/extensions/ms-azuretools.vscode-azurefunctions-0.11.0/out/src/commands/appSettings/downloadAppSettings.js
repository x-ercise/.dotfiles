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
const vscode = require("vscode");
const vscode_azureappservice_1 = require("vscode-azureappservice");
const constants_1 = require("../../constants");
const extensionVariables_1 = require("../../extensionVariables");
const LocalAppSettings_1 = require("../../LocalAppSettings");
const localize_1 = require("../../localize");
const workspaceUtil = require("../../utils/workspace");
const confirmOverwriteSettings_1 = require("./confirmOverwriteSettings");
const decryptLocalSettings_1 = require("./decryptLocalSettings");
const encryptLocalSettings_1 = require("./encryptLocalSettings");
function downloadAppSettings(node) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = yield extensionVariables_1.ext.tree.showNodePicker(vscode_azureappservice_1.AppSettingsTreeItem.contextValue);
        }
        // tslint:disable-next-line:no-non-null-assertion
        const client = node.parent.treeItem.client;
        const message = localize_1.localize('selectLocalSettings', 'Select the destination file for your downloaded settings.');
        const localSettingsPath = yield workspaceUtil.selectWorkspaceFile(extensionVariables_1.ext.ui, message, () => constants_1.localSettingsFileName);
        const localSettingsUri = vscode.Uri.file(localSettingsPath);
        yield node.runWithTemporaryDescription(localize_1.localize('downloading', 'Downloading...'), () => __awaiter(this, void 0, void 0, function* () {
            extensionVariables_1.ext.outputChannel.show(true);
            extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('downloadStart', 'Downloading settings from "{0}"...', client.fullName));
            let localSettings = yield LocalAppSettings_1.getLocalSettings(localSettingsPath);
            const isEncrypted = localSettings.IsEncrypted;
            if (localSettings.IsEncrypted) {
                yield decryptLocalSettings_1.decryptLocalSettings(localSettingsUri);
                localSettings = (yield fse.readJson(localSettingsPath));
            }
            try {
                if (!localSettings.Values) {
                    localSettings.Values = {};
                }
                const remoteSettings = yield client.listApplicationSettings();
                if (remoteSettings.properties) {
                    yield confirmOverwriteSettings_1.confirmOverwriteSettings(remoteSettings.properties, localSettings.Values, constants_1.localSettingsFileName);
                }
                yield fse.ensureFile(localSettingsPath);
                yield fse.writeJson(localSettingsPath, localSettings, { spaces: 2 });
            }
            finally {
                if (isEncrypted) {
                    yield encryptLocalSettings_1.encryptLocalSettings(localSettingsUri);
                }
            }
        }));
        const doc = yield vscode.workspace.openTextDocument(localSettingsUri);
        yield vscode.window.showTextDocument(doc);
    });
}
exports.downloadAppSettings = downloadAppSettings;
//# sourceMappingURL=downloadAppSettings.js.map