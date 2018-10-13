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
const fs = require("fs");
const vscode = require("vscode");
const vscode_azureappservice_1 = require("vscode-azureappservice");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
class FileEditor extends vscode_azureextensionui_1.BaseEditor {
    constructor() {
        super('appService.showSavePrompt');
    }
    getSaveConfirmationText(node) {
        return __awaiter(this, void 0, void 0, function* () {
            return `Saving '${node.treeItem.label}' will update the file "${node.treeItem.label}" in "${node.treeItem.client.fullName}".`;
        });
    }
    getFilename(node) {
        return __awaiter(this, void 0, void 0, function* () {
            return node.treeItem.label;
        });
    }
    getData(node) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield vscode_azureappservice_1.getFile(node.treeItem.client, node.treeItem.path);
            node.treeItem.etag = result.etag;
            return result.data;
        });
    }
    getSize(_node) {
        return __awaiter(this, void 0, void 0, function* () {
            // this is not implemented for Azure App Services
            return 0;
        });
    }
    updateData(node) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!vscode.window.activeTextEditor) {
                throw new Error('Cannot update file after it has been closed.');
            }
            const localFile = fs.createReadStream(vscode.window.activeTextEditor.document.uri.fsPath);
            // tslint:disable-next-line:no-non-null-assertion
            node.treeItem.etag = yield vscode_azureappservice_1.putFile(node.treeItem.client, localFile, node.treeItem.path, node.treeItem.etag);
            return yield this.getData(node);
        });
    }
}
exports.FileEditor = FileEditor;
//# sourceMappingURL=FileEditor.js.map