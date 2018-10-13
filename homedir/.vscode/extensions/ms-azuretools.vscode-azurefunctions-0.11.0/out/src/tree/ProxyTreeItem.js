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
const nodeUtils_1 = require("../utils/nodeUtils");
class ProxyTreeItem {
    constructor(name) {
        this.contextValue = ProxyTreeItem.contextValue;
        this._name = name;
    }
    get label() {
        return this._name;
    }
    get iconPath() {
        return nodeUtils_1.nodeUtils.getIconPath(ProxyTreeItem.contextValue);
    }
    deleteTreeItem(node) {
        return __awaiter(this, void 0, void 0, function* () {
            yield node.parent.treeItem.deleteProxy(this._name);
        });
    }
}
ProxyTreeItem.contextValue = 'azFuncProxy';
exports.ProxyTreeItem = ProxyTreeItem;
//# sourceMappingURL=ProxyTreeItem.js.map