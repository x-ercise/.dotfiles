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
const semver = require("semver");
const cpUtils_1 = require("../utils/cpUtils");
function getLocalFuncCoreToolsVersion() {
    return __awaiter(this, void 0, void 0, function* () {
        const output = yield cpUtils_1.cpUtils.executeCommand(undefined, undefined, 'func', '--version');
        const version = semver.clean(output);
        if (version) {
            return version;
        }
        else {
            // Old versions of the func cli do not support '--version', so we have to parse the command usage to get the version
            const matchResult = output.match(/(?:.*)Azure Functions Core Tools (.*)/);
            if (matchResult !== null) {
                let localVersion = matchResult[1].replace(/[()]/g, '').trim(); // remove () and whitespace
                // this is a fix for a bug currently in the Function CLI
                if (localVersion === '220.0.0-beta.0') {
                    localVersion = '2.0.1-beta.25';
                }
                return semver.valid(localVersion);
            }
            return null;
        }
    });
}
exports.getLocalFuncCoreToolsVersion = getLocalFuncCoreToolsVersion;
//# sourceMappingURL=getLocalFuncCoreToolsVersion.js.map