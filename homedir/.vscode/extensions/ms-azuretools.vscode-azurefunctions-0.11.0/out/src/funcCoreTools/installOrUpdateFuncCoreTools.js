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
const ProjectSettings_1 = require("../ProjectSettings");
const getFuncPackageManager_1 = require("./getFuncPackageManager");
const installFuncCoreTools_1 = require("./installFuncCoreTools");
const tryGetLocalRuntimeVersion_1 = require("./tryGetLocalRuntimeVersion");
const updateFuncCoreTools_1 = require("./updateFuncCoreTools");
const validateFuncCoreToolsInstalled_1 = require("./validateFuncCoreToolsInstalled");
function installOrUpdateFuncCoreTools() {
    return __awaiter(this, void 0, void 0, function* () {
        const isFuncInstalled = yield validateFuncCoreToolsInstalled_1.funcToolsInstalled();
        const packageManager = yield getFuncPackageManager_1.getFuncPackageManager(isFuncInstalled);
        if (packageManager === undefined) {
            throw new Error(localize_1.localize('installNotSupported', 'Install or update is only supported for brew or npm.'));
        }
        if (isFuncInstalled) {
            let projectRuntime = yield tryGetLocalRuntimeVersion_1.tryGetLocalRuntimeVersion();
            // tslint:disable-next-line:strict-boolean-expressions
            if (!projectRuntime) {
                projectRuntime = yield ProjectSettings_1.promptForProjectRuntime(localize_1.localize('selectLocalRuntime', 'Failed to detect local runtime automatically. Select your runtime to update'));
            }
            yield updateFuncCoreTools_1.updateFuncCoreTools(packageManager, projectRuntime);
        }
        else {
            yield installFuncCoreTools_1.installFuncCoreTools(packageManager);
        }
    });
}
exports.installOrUpdateFuncCoreTools = installOrUpdateFuncCoreTools;
//# sourceMappingURL=installOrUpdateFuncCoreTools.js.map