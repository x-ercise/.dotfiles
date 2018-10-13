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
const ProjectSettings_1 = require("../ProjectSettings");
const getLocalFuncCoreToolsVersion_1 = require("./getLocalFuncCoreToolsVersion");
function tryGetLocalRuntimeVersion() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!constants_1.isWindows) {
            return constants_1.ProjectRuntime.v2;
        }
        else {
            try {
                const version = yield getLocalFuncCoreToolsVersion_1.getLocalFuncCoreToolsVersion();
                if (version) {
                    return ProjectSettings_1.convertStringToRuntime(version);
                }
            }
            catch (err) {
                // swallow errors and return undefined
            }
            return undefined;
        }
    });
}
exports.tryGetLocalRuntimeVersion = tryGetLocalRuntimeVersion;
//# sourceMappingURL=tryGetLocalRuntimeVersion.js.map