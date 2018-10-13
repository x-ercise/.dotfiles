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
const extensionVariables_1 = require("../extensionVariables");
const localize_1 = require("../localize");
const cpUtils_1 = require("../utils/cpUtils");
const getFuncPackageManager_1 = require("./getFuncPackageManager");
const validateFuncCoreToolsInstalled_1 = require("./validateFuncCoreToolsInstalled");
function uninstallFuncCoreTools() {
    return __awaiter(this, void 0, void 0, function* () {
        extensionVariables_1.ext.outputChannel.show();
        if (yield validateFuncCoreToolsInstalled_1.funcToolsInstalled()) {
            switch (yield getFuncPackageManager_1.getFuncPackageManager(true /* isFuncInstalled */)) {
                case constants_1.PackageManager.npm:
                    yield cpUtils_1.cpUtils.executeCommand(extensionVariables_1.ext.outputChannel, undefined, 'npm', 'uninstall', '-g', constants_1.funcPackageName);
                    break;
                case constants_1.PackageManager.brew:
                    yield cpUtils_1.cpUtils.executeCommand(extensionVariables_1.ext.outputChannel, undefined, 'brew', 'uninstall', constants_1.funcPackageName);
                    break;
                default:
                    throw new Error(localize_1.localize('cannotUninstall', 'Uninstall is only supported for brew or npm.'));
                    break;
            }
        }
        else {
            throw new Error(localize_1.localize('notInstalled', 'Cannot uninstall Azure Functions Core Tools because it is not installed.'));
        }
    });
}
exports.uninstallFuncCoreTools = uninstallFuncCoreTools;
//# sourceMappingURL=uninstallFuncCoreTools.js.map