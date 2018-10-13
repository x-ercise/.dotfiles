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
const util = require("../util");
// tslint:disable-next-line:export-name
function isJavaRuntime(runtime) {
    if (runtime) {
        const lowerCaseRuntime = runtime.toLowerCase();
        return lowerCaseRuntime.startsWith(constants_1.runtimes.tomcat) ||
            lowerCaseRuntime === constants_1.runtimes.javase;
    }
    return false;
}
exports.isJavaRuntime = isJavaRuntime;
function getJavaRuntimeTargetFile(runtime, telemetryProperties) {
    return __awaiter(this, void 0, void 0, function* () {
        let fileExtension;
        if (runtime && runtime.toLowerCase() === constants_1.runtimes.javase) {
            fileExtension = 'jar';
        }
        else if (runtime && runtime.toLowerCase().startsWith(constants_1.runtimes.tomcat)) {
            fileExtension = 'war';
        }
        else {
            throw new Error(`Invalid java runtime: ${runtime}`);
        }
        return util.showQuickPickByFileExtension(telemetryProperties, `Select the ${fileExtension} file to deploy...`, fileExtension);
    });
}
exports.getJavaRuntimeTargetFile = getJavaRuntimeTargetFile;
//# sourceMappingURL=javaUtils.js.map