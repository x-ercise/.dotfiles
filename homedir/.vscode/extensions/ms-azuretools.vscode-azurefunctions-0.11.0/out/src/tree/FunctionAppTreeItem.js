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
const localize_1 = require("../localize");
const nodeUtils_1 = require("../utils/nodeUtils");
const FunctionsTreeItem_1 = require("./FunctionsTreeItem");
const FunctionTreeItem_1 = require("./FunctionTreeItem");
const ProxiesTreeItem_1 = require("./ProxiesTreeItem");
const ProxyTreeItem_1 = require("./ProxyTreeItem");
class FunctionAppTreeItem {
    constructor(client, isLinuxPreview) {
        this.contextValue = FunctionAppTreeItem.contextValue;
        this.logStreamPath = '';
        this.client = client;
        this._state = client.initialState;
        this._functionsTreeItem = new FunctionsTreeItem_1.FunctionsTreeItem(client);
        this._appSettingsTreeItem = new vscode_azureappservice_1.AppSettingsTreeItem(client);
        this._proxiesTreeItem = new ProxiesTreeItem_1.ProxiesTreeItem(client);
        this._isLinuxPreview = isLinuxPreview;
    }
    get logStreamLabel() {
        return this.client.fullName;
    }
    get id() {
        return this.client.id;
    }
    get label() {
        return this.client.fullName;
    }
    get description() {
        const stateDescription = this._state && this._state.toLowerCase() !== 'running' ? this._state : undefined;
        const previewDescription = this._isLinuxPreview ? localize_1.localize('linuxPreview', 'Linux Preview') : undefined;
        if (stateDescription && previewDescription) {
            return `${previewDescription} - ${stateDescription}`;
        }
        else {
            return stateDescription || previewDescription;
        }
    }
    get iconPath() {
        return nodeUtils_1.nodeUtils.getIconPath(FunctionAppTreeItem.contextValue);
    }
    hasMoreChildren() {
        return false;
    }
    refreshLabel() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this._state = yield this.client.getState();
            }
            catch (_a) {
                this._state = 'Unknown';
            }
        });
    }
    loadMoreChildren() {
        return __awaiter(this, void 0, void 0, function* () {
            return [this._functionsTreeItem, this._appSettingsTreeItem, this._proxiesTreeItem];
        });
    }
    pickTreeItem(expectedContextValue) {
        switch (expectedContextValue) {
            case FunctionsTreeItem_1.FunctionsTreeItem.contextValue:
            case FunctionTreeItem_1.FunctionTreeItem.contextValue:
                return this._functionsTreeItem;
            case vscode_azureappservice_1.AppSettingsTreeItem.contextValue:
            case vscode_azureappservice_1.AppSettingTreeItem.contextValue:
                return this._appSettingsTreeItem;
            case ProxiesTreeItem_1.ProxiesTreeItem.contextValue:
            case ProxyTreeItem_1.ProxyTreeItem.contextValue:
                return this._proxiesTreeItem;
            default:
                return undefined;
        }
    }
    deleteTreeItem(_node) {
        return __awaiter(this, void 0, void 0, function* () {
            yield vscode_azureappservice_1.deleteSite(this.client);
        });
    }
}
FunctionAppTreeItem.contextValue = 'azFuncFunctionApp';
exports.FunctionAppTreeItem = FunctionAppTreeItem;
//# sourceMappingURL=FunctionAppTreeItem.js.map