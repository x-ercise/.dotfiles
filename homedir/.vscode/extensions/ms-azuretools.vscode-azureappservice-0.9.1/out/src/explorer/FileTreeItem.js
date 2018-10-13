"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
class FileTreeItem {
    constructor(client, label, path) {
        this.client = client;
        this.label = label;
        this.path = path;
        this.contextValue = FileTreeItem.contextValue;
        this.commandId = 'appService.showFile';
    }
    get iconPath() {
        return {
            light: path_1.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'File_16x.svg'),
            dark: path_1.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'File_16x.svg')
        };
    }
}
FileTreeItem.contextValue = 'file';
exports.FileTreeItem = FileTreeItem;
//# sourceMappingURL=FileTreeItem.js.map