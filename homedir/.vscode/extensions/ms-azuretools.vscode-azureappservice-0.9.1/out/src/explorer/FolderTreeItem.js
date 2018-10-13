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
const FileTreeItem_1 = require("./FileTreeItem");
class FolderTreeItem {
    constructor(client, label, folderPath, subcontextValue) {
        this.client = client;
        this.label = label;
        this.folderPath = folderPath;
        this.subcontextValue = subcontextValue;
        this.childTypeLabel = 'files';
        this.contextValue = subcontextValue ? subcontextValue : FolderTreeItem.contextValue;
    }
    get iconPath() {
        return this.contextValue === 'subFolder' ? undefined : {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'Folder_16x.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'Folder_16x.svg')
        }; // no icons for subfolders
    }
    hasMoreChildren() {
        return false;
    }
    loadMoreChildren() {
        return __awaiter(this, void 0, void 0, function* () {
            const kuduClient = yield vscode_azureappservice_1.getKuduClient(this.client);
            const httpResponse = (yield kuduClient.vfs.getItemWithHttpOperationResponse(this.folderPath)).response;
            // response contains a body with a JSON parseable string
            const fileList = JSON.parse(httpResponse.body);
            const home = 'home';
            const filteredList = fileList.filter((file) => {
                if (file.mime === 'text/xml' && file.name.includes('LogFiles-kudu-trace_pending.xml')) {
                    // this file is being accessed by Kudu and is not viewable
                    return false;
                }
                return true;
            });
            return filteredList.map((file) => {
                return file.mime === 'inode/directory' ?
                    // truncate the home of the path
                    // the substring starts at file.path.indexOf(home) because the path sometimes includes site/ or D:\
                    // the home.length + 1 is to account for the trailing slash, Linux uses / and Window uses \
                    new FolderTreeItem(this.client, file.name, file.path.substring(file.path.indexOf(home) + home.length + 1), 'subFolder') :
                    new FileTreeItem_1.FileTreeItem(this.client, file.name, file.path.substring(file.path.indexOf(home) + home.length + 1));
            });
        });
    }
}
FolderTreeItem.contextValue = 'folder';
exports.FolderTreeItem = FolderTreeItem;
//# sourceMappingURL=FolderTreeItem.js.map