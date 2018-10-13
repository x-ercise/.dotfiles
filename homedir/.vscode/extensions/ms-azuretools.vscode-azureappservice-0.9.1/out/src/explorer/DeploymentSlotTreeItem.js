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
const path = require("path");
const vscode_azureappservice_1 = require("vscode-azureappservice");
const FolderTreeItem_1 = require("./FolderTreeItem");
const SiteTreeItem_1 = require("./SiteTreeItem");
class DeploymentSlotTreeItem extends SiteTreeItem_1.SiteTreeItem {
    constructor(client) {
        super(client);
        this.contextValue = DeploymentSlotTreeItem.contextValue;
        this.folderNode = new FolderTreeItem_1.FolderTreeItem(this.client, 'Files', "/site/wwwroot");
        this.logFolderNode = new FolderTreeItem_1.FolderTreeItem(this.client, 'Log Files', '/LogFiles', 'logFolder');
        this.appSettingsNode = new vscode_azureappservice_1.AppSettingsTreeItem(this.client);
    }
    get iconPath() {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'DeploymentSlot_color.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'DeploymentSlot_color.svg')
        };
    }
    loadMoreChildren(_node) {
        return __awaiter(this, void 0, void 0, function* () {
            return [this.folderNode, this.logFolderNode, this.appSettingsNode];
        });
    }
    pickTreeItem(expectedContextValue) {
        switch (expectedContextValue) {
            case vscode_azureappservice_1.AppSettingsTreeItem.contextValue:
                return this.appSettingsNode;
            case FolderTreeItem_1.FolderTreeItem.contextValue:
                return this.folderNode;
            default:
                return undefined;
        }
    }
}
DeploymentSlotTreeItem.contextValue = 'deploymentSlot';
exports.DeploymentSlotTreeItem = DeploymentSlotTreeItem;
//# sourceMappingURL=DeploymentSlotTreeItem.js.map