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
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const extensionVariables_1 = require("../extensionVariables");
const localize_1 = require("../localize");
const nodeUtils_1 = require("../utils/nodeUtils");
const ProxyTreeItem_1 = require("./ProxyTreeItem");
class ProxiesTreeItem {
    constructor(client) {
        this.contextValue = ProxiesTreeItem.contextValue;
        this.label = localize_1.localize('azFunc.Proxies', 'Proxies');
        this.childTypeLabel = localize_1.localize('azFunc.Proxy', 'Proxy');
        this._proxiesJsonPath = 'site/wwwroot/proxies.json';
        this._deletingProxy = false;
        this._client = client;
    }
    get id() {
        return 'proxies';
    }
    get iconPath() {
        return nodeUtils_1.nodeUtils.getThemedIconPath('BulletList');
    }
    hasMoreChildren() {
        return false;
    }
    loadMoreChildren() {
        return __awaiter(this, void 0, void 0, function* () {
            let proxiesJson;
            try {
                const result = yield vscode_azureappservice_1.getFile(this._client, this._proxiesJsonPath);
                proxiesJson = result.data;
                this._etag = result.etag;
            }
            catch (err) {
                // if the proxies.json file does not exist, that means there are no proxies
                return [];
            }
            try {
                const rawProxyConfig = JSON.parse(proxiesJson);
                if (!rawProxyConfig.proxies) {
                    rawProxyConfig.proxies = {};
                }
                this._proxyConfig = rawProxyConfig;
                return Object.keys(this._proxyConfig.proxies).map((name) => new ProxyTreeItem_1.ProxyTreeItem(name));
            }
            catch (err) {
                throw new Error(localize_1.localize('failedToParseProxyConfig', 'Failed to parse "proxies.json" file: {0}', vscode_azureextensionui_1.parseError(err).message));
            }
        });
    }
    deleteProxy(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const message = localize_1.localize('azFunc.ConfirmDelete', 'Are you sure you want to delete proxy "{0}"?', name);
            yield extensionVariables_1.ext.ui.showWarningMessage(message, { modal: true }, vscode_azureextensionui_1.DialogResponses.deleteResponse, vscode_azureextensionui_1.DialogResponses.cancel);
            if (this._deletingProxy) {
                throw new Error(localize_1.localize('multipleProxyOperations', 'An operation on the proxy config is already in progress. Wait until it has finished and try again.'));
            }
            else {
                this._deletingProxy = true;
                try {
                    extensionVariables_1.ext.outputChannel.show(true);
                    extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('DeletingProxy', 'Deleting proxy "{0}"...', name));
                    delete this._proxyConfig.proxies[name];
                    const data = JSON.stringify(this._proxyConfig);
                    this._etag = yield vscode_azureappservice_1.putFile(this._client, data, this._proxiesJsonPath, this._etag);
                    extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('DeleteProxySucceeded', 'Successfully deleted proxy "{0}".', name));
                }
                finally {
                    this._deletingProxy = false;
                }
            }
        });
    }
}
ProxiesTreeItem.contextValue = 'azFuncProxies';
exports.ProxiesTreeItem = ProxiesTreeItem;
//# sourceMappingURL=ProxiesTreeItem.js.map