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
const constants_1 = require("../constants");
const cpUtils_1 = require("../utils/cpUtils");
function getFuncPackageManager(isFuncInstalled) {
    return __awaiter(this, void 0, void 0, function* () {
        switch (process.platform) {
            case constants_1.Platform.Linux:
                // https://github.com/Microsoft/vscode-azurefunctions/issues/311
                return undefined;
            case constants_1.Platform.MacOS:
                try {
                    isFuncInstalled ?
                        yield cpUtils_1.cpUtils.executeCommand(undefined, undefined, 'brew', 'ls', constants_1.funcPackageName) :
                        yield cpUtils_1.cpUtils.executeCommand(undefined, undefined, 'brew', '--version');
                    return constants_1.PackageManager.brew;
                }
                catch (error) {
                    // an error indicates no brew; continue to default, npm case
                }
            default:
                try {
                    isFuncInstalled ?
                        yield cpUtils_1.cpUtils.executeCommand(undefined, undefined, 'npm', 'ls', '-g', constants_1.funcPackageName) :
                        yield cpUtils_1.cpUtils.executeCommand(undefined, undefined, 'npm', '--version');
                    return constants_1.PackageManager.npm;
                }
                catch (error) {
                    return undefined;
                }
        }
    });
}
exports.getFuncPackageManager = getFuncPackageManager;
//# sourceMappingURL=getFuncPackageManager.js.map