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
const localize_1 = require("../../localize");
const workspaceUtil = require("../../utils/workspace");
const confirmOverwriteSettings_1 = require("./confirmOverwriteSettings");
const decryptLocalSettings_1 = require("./decryptLocalSettings");
const encryptLocalSettings_1 = require("./encryptLocalSettings");
function uploadAppSettings(node) {
    return __awaiter(this, void 0, void 0, function* () {
        const message = localize_1.localize('selectLocalSettings', 'Select the local settings file to upload.');
        const localSettingsPath = yield workspaceUtil.selectWorkspaceFile(extensionVariables_1.ext.ui, message, () => constants_1.localSettingsFileName);
        const localSettingsUri = vscode.Uri.file(localSettingsPath);
        if (!node) {
            node = yield extensionVariables_1.ext.tree.showNodePicker(vscode_azureappservice_1.AppSettingsTreeItem.contextValue);
        }
        // tslint:disable-next-line:no-non-null-assertion
        const client = node.parent.treeItem.client;
        yield node.runWithTemporaryDescription(localize_1.localize('uploading', 'Uploading...'), () => __awaiter(this, void 0, void 0, function* () {
            extensionVariables_1.ext.outputChannel.show(true);
            extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('uploadStart', 'Uploading settings to "{0}"...', client.fullName));
            let localSettings = yield fse.readJson(localSettingsPath);
            if (localSettings.IsEncrypted) {
                yield decryptLocalSettings_1.decryptLocalSettings(localSettingsUri);
                try {
                    localSettings = (yield fse.readJson(localSettingsPath));
                }
                finally {
                    yield encryptLocalSettings_1.encryptLocalSettings(localSettingsUri);
                }
            }
            if (localSettings.Values) {
                const remoteSettings = yield client.listApplicationSettings();
                if (!remoteSettings.properties) {
                    remoteSettings.properties = {};
                }
                yield confirmOverwriteSettings_1.confirmOverwriteSettings(localSettings.Values, remoteSettings.properties, client.fullName);
                yield client.updateApplicationSettings(remoteSettings);
            }
            else {
                throw new Error(localize_1.localize('noSettings', 'No settings found in "{0}".', constants_1.localSettingsFileName));
            }
        }));
    });
}
exports.uploadAppSettings = uploadAppSettings;
//# sourceMappingURL=uploadAppSettings.js.map