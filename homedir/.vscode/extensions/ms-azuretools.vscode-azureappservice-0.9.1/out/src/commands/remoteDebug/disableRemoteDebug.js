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
const vscode = require("vscode");
const WebAppTreeItem_1 = require("../../explorer/WebAppTreeItem");
const extensionVariables_1 = require("../../extensionVariables");
const remoteDebug = require("./remoteDebugCommon");
function disableRemoteDebug(node) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = (yield extensionVariables_1.ext.tree.showNodePicker(WebAppTreeItem_1.WebAppTreeItem.contextValue));
        }
        const siteClient = node.treeItem.client;
        const confirmMessage = 'The app configuration will be updated to disable remote debugging and restarted. Would you like to continue?';
        const noopMessage = 'The app is not configured for debugging.';
        yield vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, (progress) => __awaiter(this, void 0, void 0, function* () {
            remoteDebug.reportMessage('Fetching site configuration...', progress);
            const siteConfig = yield siteClient.getSiteConfig();
            remoteDebug.checkForRemoteDebugSupport(siteConfig);
            yield remoteDebug.setRemoteDebug(false, confirmMessage, noopMessage, siteClient, siteConfig, progress);
        }));
    });
}
exports.disableRemoteDebug = disableRemoteDebug;
//# sourceMappingURL=disableRemoteDebug.js.map