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
const localize_1 = require("../localize");
var nodeUtils;
(function (nodeUtils) {
    function getIconPath(iconName) {
        return path.join(__filename, '..', '..', '..', '..', 'resources', `${iconName}.svg`);
    }
    nodeUtils.getIconPath = getIconPath;
    function getThemedIconPath(iconName) {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', `${iconName}.svg`),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', `${iconName}.svg`)
        };
    }
    nodeUtils.getThemedIconPath = getThemedIconPath;
    function getSubscriptionNode(tree, subscriptionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const node = (yield tree.getChildren()).find((n) => n.subscriptionId === subscriptionId);
            if (node) {
                return node;
            }
            else {
                throw new Error(localize_1.localize('noMatchingSubscription', 'Failed to find a subscription matching id "{0}".', subscriptionId));
            }
        });
    }
    nodeUtils.getSubscriptionNode = getSubscriptionNode;
})(nodeUtils = exports.nodeUtils || (exports.nodeUtils = {}));
//# sourceMappingURL=nodeUtils.js.map