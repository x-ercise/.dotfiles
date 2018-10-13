"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
class FunctionCreatorBase {
    constructor(functionAppPath, template) {
        this._functionNameRegex = /^[a-zA-Z][a-zA-Z\d_\-]*$/;
        this._functionAppPath = functionAppPath;
        this._template = template;
    }
}
exports.FunctionCreatorBase = FunctionCreatorBase;
//# sourceMappingURL=FunctionCreatorBase.js.map