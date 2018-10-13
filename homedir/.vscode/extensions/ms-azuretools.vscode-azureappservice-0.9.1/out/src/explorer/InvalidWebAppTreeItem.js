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
class InvalidWebAppTreeItem {
    // tslint:disable-next-line:no-any
    constructor(label, error) {
        this.contextValue = InvalidWebAppTreeItem.contextValue;
        this.description = 'Invalid';
        this.label = label;
        this._error = error;
    }
    get iconPath() {
        const iconName = 'WebApp_grayscale.svg';
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', iconName),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', iconName)
        };
    }
    loadMoreChildren(_node, _clearCache) {
        return __awaiter(this, void 0, void 0, function* () {
            throw this._error;
        });
    }
    hasMoreChildren() {
        return false;
    }
}
InvalidWebAppTreeItem.contextValue = 'invalidAppService';
exports.InvalidWebAppTreeItem = InvalidWebAppTreeItem;
//# sourceMappingURL=InvalidWebAppTreeItem.js.map