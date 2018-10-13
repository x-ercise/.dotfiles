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
const appservice = require("vscode-azureappservice");
const WebAppTreeItem_1 = require("../explorer/WebAppTreeItem");
const extensionVariables_1 = require("../extensionVariables");
const enableFileLogging_1 = require("./enableFileLogging");
function startStreamingLogs(node) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = (yield extensionVariables_1.ext.tree.showNodePicker(WebAppTreeItem_1.WebAppTreeItem.contextValue));
        }
        const verifyLoggingEnabled = () => __awaiter(this, void 0, void 0, function* () {
            const isEnabled = yield vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, (p) => __awaiter(this, void 0, void 0, function* () {
                p.report({ message: 'Checking container diagnostics settings...' });
                // tslint:disable-next-line:no-non-null-assertion
                return yield node.treeItem.isHttpLogsEnabled();
            }));
            if (!isEnabled) {
                // tslint:disable-next-line:no-non-null-assertion
                yield enableFileLogging_1.enableFileLogging(node);
            }
        });
        yield appservice.startStreamingLogs(node.treeItem.client, verifyLoggingEnabled, node.treeItem.logStreamLabel);
    });
}
exports.startStreamingLogs = startStreamingLogs;
//# sourceMappingURL=startStreamingLogs.js.map