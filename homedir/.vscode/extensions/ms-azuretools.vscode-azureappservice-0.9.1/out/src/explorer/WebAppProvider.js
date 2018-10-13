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
const azure_arm_website_1 = require("azure-arm-website");
const vscode_1 = require("vscode");
const vscode_azureappservice_1 = require("vscode-azureappservice");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const constants_1 = require("../constants");
const InvalidWebAppTreeItem_1 = require("./InvalidWebAppTreeItem");
const WebAppTreeItem_1 = require("./WebAppTreeItem");
class WebAppProvider {
    constructor() {
        this.childTypeLabel = 'Web App';
    }
    hasMoreChildren() {
        return this._nextLink !== undefined;
    }
    loadMoreChildren(node, clearCache) {
        return __awaiter(this, void 0, void 0, function* () {
            if (clearCache) {
                this._nextLink = undefined;
            }
            const client = new azure_arm_website_1.WebSiteManagementClient(node.credentials, node.subscriptionId, node.environment.resourceManagerEndpointUrl);
            vscode_azureextensionui_1.addExtensionUserAgent(client);
            let webAppCollection;
            try {
                webAppCollection = this._nextLink === undefined ?
                    yield client.webApps.list() :
                    yield client.webApps.listNext(this._nextLink);
            }
            catch (error) {
                if (vscode_azureextensionui_1.parseError(error).errorType.toLowerCase() === 'notfound') {
                    // This error type means the 'Microsoft.Web' provider has not been registered in this subscription
                    // In that case, we know there are no web apps, so we can return an empty array
                    // (The provider will be registered automatically if the user creates a new web app)
                    return [];
                }
                else {
                    throw error;
                }
            }
            this._nextLink = webAppCollection.nextLink;
            const treeItems = [];
            yield Promise.all(webAppCollection
                .map((s) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const siteClient = new vscode_azureappservice_1.SiteClient(s, node);
                    if (!siteClient.isFunctionApp) {
                        treeItems.push(new WebAppTreeItem_1.WebAppTreeItem(siteClient));
                    }
                }
                catch (error) {
                    if (s.name) {
                        treeItems.push(new InvalidWebAppTreeItem_1.InvalidWebAppTreeItem(s.name, error));
                    }
                }
            })));
            return treeItems;
        });
    }
    createChild(node, showCreatingNode, actionContext) {
        return __awaiter(this, void 0, void 0, function* () {
            const workspaceConfig = vscode_1.workspace.getConfiguration(constants_1.extensionPrefix);
            const advancedCreation = workspaceConfig.get(constants_1.configurationSettings.advancedCreation);
            const newSite = yield vscode_azureappservice_1.createWebApp(actionContext, node, showCreatingNode, advancedCreation);
            if (newSite === undefined) {
                throw new vscode_azureextensionui_1.UserCancelledError();
            }
            else {
                const siteClient = new vscode_azureappservice_1.SiteClient(newSite, node);
                return new WebAppTreeItem_1.WebAppTreeItem(siteClient);
            }
        });
    }
}
exports.WebAppProvider = WebAppProvider;
//# sourceMappingURL=WebAppProvider.js.map