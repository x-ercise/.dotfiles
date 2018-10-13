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
const util_1 = require("util");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const localize_1 = require("../localize");
const nodeUtils_1 = require("../utils/nodeUtils");
const FunctionTreeItem_1 = require("./FunctionTreeItem");
class FunctionsTreeItem {
    constructor(client) {
        this.contextValue = FunctionsTreeItem.contextValue;
        this.label = localize_1.localize('azFunc.Functions', 'Functions');
        this.childTypeLabel = localize_1.localize('azFunc.Function', 'Function');
        this._client = client;
    }
    get id() {
        return 'functions';
    }
    get iconPath() {
        return nodeUtils_1.nodeUtils.getThemedIconPath('BulletList');
    }
    hasMoreChildren() {
        return this._nextLink !== undefined;
    }
    loadMoreChildren(_node, clearCache) {
        return __awaiter(this, void 0, void 0, function* () {
            if (clearCache) {
                this._nextLink = undefined;
            }
            const funcs = this._nextLink ? yield this._client.listFunctionsNext(this._nextLink) : yield this._client.listFunctions();
            // https://github.com/Azure/azure-functions-host/issues/3502
            if (!util_1.isArray(funcs)) {
                throw new Error(localize_1.localize('failedToList', 'Failed to list functions.'));
            }
            this._nextLink = funcs.nextLink;
            return yield vscode_azureextensionui_1.createTreeItemsWithErrorHandling(funcs, 'azFuncInvalidFunction', (fe) => __awaiter(this, void 0, void 0, function* () {
                const treeItem = new FunctionTreeItem_1.FunctionTreeItem(this._client, fe);
                if (treeItem.config.isHttpTrigger) {
                    // We want to cache the trigger url so that it is instantaneously copied when the user performs the copy action
                    // (Otherwise there might be a second or two delay which could lead to confusion)
                    yield treeItem.initializeTriggerUrl();
                }
                return treeItem;
            }), (fe) => {
                return fe.id ? FunctionTreeItem_1.getFunctionNameFromId(fe.id) : undefined;
            });
        });
    }
}
FunctionsTreeItem.contextValue = 'azFuncFunctions';
exports.FunctionsTreeItem = FunctionsTreeItem;
//# sourceMappingURL=FunctionsTreeItem.js.map