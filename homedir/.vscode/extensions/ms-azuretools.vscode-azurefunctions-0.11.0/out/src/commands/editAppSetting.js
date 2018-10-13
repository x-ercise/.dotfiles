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
const vscode_azureappservice_1 = require("vscode-azureappservice");
function editAppSetting(tree, node) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = (yield tree.showNodePicker(vscode_azureappservice_1.AppSettingTreeItem.contextValue));
        }
        yield node.treeItem.edit(node);
    });
}
exports.editAppSetting = editAppSetting;
//# sourceMappingURL=editAppSetting.js.map