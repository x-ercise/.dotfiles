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
const appservice = require("vscode-azureappservice");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const extensionVariables_1 = require("../../extensionVariables");
const localize_1 = require("../../localize");
const FunctionAppTreeItem_1 = require("../../tree/FunctionAppTreeItem");
function startStreamingLogs(node) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = (yield extensionVariables_1.ext.tree.showNodePicker(FunctionAppTreeItem_1.FunctionAppTreeItem.contextValue));
        }
        const treeItem = node.treeItem;
        const verifyLoggingEnabled = () => __awaiter(this, void 0, void 0, function* () {
            const logsConfig = yield treeItem.client.getLogsConfig();
            if (!isApplicationLoggingEnabled(logsConfig)) {
                const message = localize_1.localize('enableApplicationLogging', 'Do you want to enable application logging for "{0}"?', treeItem.client.fullName);
                yield extensionVariables_1.ext.ui.showWarningMessage(message, { modal: true }, vscode_azureextensionui_1.DialogResponses.yes, vscode_azureextensionui_1.DialogResponses.cancel);
                // tslint:disable-next-line:strict-boolean-expressions
                logsConfig.applicationLogs = logsConfig.applicationLogs || {};
                // tslint:disable-next-line:strict-boolean-expressions
                logsConfig.applicationLogs.fileSystem = logsConfig.applicationLogs.fileSystem || {};
                logsConfig.applicationLogs.fileSystem.level = 'Information';
                // Azure will throw errors if these have incomplete information (aka missing a sasUrl). Since we already know these are turned off, just make them undefined
                logsConfig.applicationLogs.azureBlobStorage = undefined;
                logsConfig.applicationLogs.azureTableStorage = undefined;
                yield treeItem.client.updateLogsConfig(logsConfig);
            }
        });
        yield appservice.startStreamingLogs(treeItem.client, verifyLoggingEnabled, treeItem.logStreamLabel, treeItem.logStreamPath);
    });
}
exports.startStreamingLogs = startStreamingLogs;
function isApplicationLoggingEnabled(config) {
    if (config.applicationLogs) {
        if (config.applicationLogs.fileSystem) {
            return config.applicationLogs.fileSystem.level !== undefined && config.applicationLogs.fileSystem.level.toLowerCase() !== 'off';
        }
        else if (config.applicationLogs.azureBlobStorage) {
            return config.applicationLogs.azureBlobStorage.level !== undefined && config.applicationLogs.azureBlobStorage.level.toLowerCase() !== 'off';
        }
        else if (config.applicationLogs.azureTableStorage) {
            return config.applicationLogs.azureTableStorage.level !== undefined && config.applicationLogs.azureTableStorage.level.toLowerCase() !== 'off';
        }
    }
    return false;
}
//# sourceMappingURL=startStreamingLogs.js.map