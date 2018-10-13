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
const vscode_1 = require("vscode");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const extensionVariables_1 = require("../extensionVariables");
function enableFileLogging(node) {
    return __awaiter(this, void 0, void 0, function* () {
        yield extensionVariables_1.ext.ui.showWarningMessage(`Do you want to enable file logging for ${node.treeItem.client.fullName}? The web app will be restarted.`, { modal: true }, vscode_azureextensionui_1.DialogResponses.yes);
        const enablingLogging = `Enabling Logging for "${node.treeItem.client.fullName}"...`;
        const enabledLogging = `Enabled Logging for "${node.treeItem.client.fullName}".`;
        yield vscode_1.window.withProgress({ location: vscode_1.ProgressLocation.Notification, title: enablingLogging }, () => __awaiter(this, void 0, void 0, function* () {
            extensionVariables_1.ext.outputChannel.appendLine(enablingLogging);
            // tslint:disable-next-line:no-non-null-assertion
            yield node.treeItem.enableHttpLogs();
            yield vscode_1.commands.executeCommand('appService.Restart', node);
            vscode_1.window.showInformationMessage(enabledLogging);
            extensionVariables_1.ext.outputChannel.appendLine(enabledLogging);
        }));
    });
}
exports.enableFileLogging = enableFileLogging;
//# sourceMappingURL=enableFileLogging.js.map