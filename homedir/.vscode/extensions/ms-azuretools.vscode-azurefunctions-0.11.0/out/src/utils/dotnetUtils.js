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
const localize_1 = require("../localize");
const cpUtils_1 = require("./cpUtils");
var dotnetUtils;
(function (dotnetUtils) {
    function validateDotnetInstalled() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield cpUtils_1.cpUtils.executeCommand(undefined, undefined, 'dotnet', '--version');
            }
            catch (error) {
                throw new Error(localize_1.localize('dotnetNotInstalled', 'You must have the .NET CLI installed to perform this operation.'));
            }
        });
    }
    dotnetUtils.validateDotnetInstalled = validateDotnetInstalled;
})(dotnetUtils = exports.dotnetUtils || (exports.dotnetUtils = {}));
//# sourceMappingURL=dotnetUtils.js.map