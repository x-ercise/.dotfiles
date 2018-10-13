"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
function isSubpath(expectedParent, expectedChild) {
    const relativePath = path_1.relative(expectedParent, expectedChild);
    return relativePath !== '' && !relativePath.startsWith('..') && relativePath !== expectedChild;
}
exports.isSubpath = isSubpath;
function isPathEqual(fsPath1, fsPath2) {
    const relativePath = path_1.relative(fsPath1, fsPath2);
    return relativePath === '';
}
exports.isPathEqual = isPathEqual;
//# sourceMappingURL=pathUtils.js.map