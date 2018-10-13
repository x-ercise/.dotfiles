"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const localize_1 = require("./localize");
var HttpAuthLevel;
(function (HttpAuthLevel) {
    HttpAuthLevel["admin"] = "admin";
    HttpAuthLevel["function"] = "function";
    HttpAuthLevel["anonymous"] = "anonymous";
})(HttpAuthLevel = exports.HttpAuthLevel || (exports.HttpAuthLevel = {}));
var BindingDirection;
(function (BindingDirection) {
    BindingDirection["in"] = "in";
    BindingDirection["out"] = "out";
})(BindingDirection || (BindingDirection = {}));
/**
 * Basic config for a function, stored in the 'function.json' file at the root of the function's folder
 * Since the user can manually edit their 'function.json' file, we can't assume it will have the proper schema
 */
class FunctionConfig {
    // tslint:disable-next-line:no-any
    constructor(data) {
        this.isHttpTrigger = false;
        this.authLevel = HttpAuthLevel.function;
        this._noInBindingError = new Error(localize_1.localize('noInBinding', 'Failed to find binding with direction "in" for this function.'));
        let errMessage;
        try {
            if (data === null || data === undefined) {
                errMessage = localize_1.localize('noDataError', 'No data was supplied.');
            }
            else {
                // tslint:disable-next-line:no-unsafe-any
                this.disabled = data.disabled === true;
                // tslint:disable-next-line:no-unsafe-any
                if (!data.bindings || !(data.bindings instanceof Array)) {
                    errMessage = localize_1.localize('expectedBindings', 'Expected "bindings" element of type "Array".');
                }
                else {
                    this.functionJson = data;
                    const inBinding = this.functionJson.bindings.find((b) => b.direction === BindingDirection.in);
                    if (inBinding === undefined && this.functionJson.bindings.length > 0) {
                        // The generated 'function.json' file for C# class libraries doesn't have direction information (by design), so just use the first
                        this._inBinding = this.functionJson.bindings[0];
                    }
                    else {
                        this._inBinding = inBinding;
                    }
                    if (this._inBinding) {
                        if (!this._inBinding.type) {
                            errMessage = localize_1.localize('inBindingTypeError', 'The binding with direction "in" must have a type.');
                        }
                        else {
                            this._inBindingType = this._inBinding.type;
                            if (this._inBinding.type.toLowerCase() === 'httptrigger') {
                                this.isHttpTrigger = true;
                                if (this._inBinding.authLevel) {
                                    const authLevel = HttpAuthLevel[this._inBinding.authLevel.toLowerCase()];
                                    if (authLevel === undefined) {
                                        errMessage = localize_1.localize('unrecognizedAuthLevel', 'Unrecognized auth level "{0}".', this._inBinding.authLevel);
                                    }
                                    else {
                                        this.authLevel = authLevel;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        catch (error) {
            errMessage = (vscode_azureextensionui_1.parseError(error)).message;
        }
        if (errMessage !== undefined) {
            throw new Error(localize_1.localize('functionJsonParseError', 'Failed to parse function.json: {0}', errMessage));
        }
    }
    get inBinding() {
        if (!this._inBinding) {
            throw this._noInBindingError;
        }
        else {
            return this._inBinding;
        }
    }
    get inBindingType() {
        if (!this._inBindingType) {
            throw this._noInBindingError;
        }
        else {
            return this._inBindingType;
        }
    }
}
exports.FunctionConfig = FunctionConfig;
//# sourceMappingURL=FunctionConfig.js.map