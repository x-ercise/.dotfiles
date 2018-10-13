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
const fse = require("fs-extra");
const path = require("path");
const constants_1 = require("../../constants");
const ScriptFunctionCreator_1 = require("../createFunction/ScriptFunctionCreator");
const CSharpProjectCreator_1 = require("./CSharpProjectCreator");
/**
 * Returns the project language if we can uniquely detect it for this folder, otherwise returns undefined
 */
function detectProjectLanguage(functionAppPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const isJava = yield isJavaProject(functionAppPath);
        const isCSharp = yield isCSharpProject(functionAppPath);
        const scriptProjectLanguage = yield getScriptLanguage(functionAppPath);
        if (scriptProjectLanguage !== undefined && !isJava && !isCSharp) {
            return scriptProjectLanguage;
        }
        else if (isJava && !isCSharp) {
            return constants_1.ProjectLanguage.Java;
        }
        else if (isCSharp && !isJava) {
            return constants_1.ProjectLanguage.CSharp;
        }
        else {
            return undefined;
        }
    });
}
exports.detectProjectLanguage = detectProjectLanguage;
function isJavaProject(functionAppPath) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield fse.pathExists(path.join(functionAppPath, 'pom.xml'));
    });
}
function isCSharpProject(functionAppPath) {
    return __awaiter(this, void 0, void 0, function* () {
        return (yield CSharpProjectCreator_1.tryGetCsprojFile(functionAppPath)) !== undefined;
    });
}
/**
 * Script projects will always be in the following structure: <Root project dir>/<function dir>/<function script file>
 * To detect the language, we can check for any "function script file" that matches the well-known filename for each language
 */
function getScriptLanguage(functionAppPath) {
    return __awaiter(this, void 0, void 0, function* () {
        let projectLanguage;
        const functionDirs = yield fse.readdir(functionAppPath);
        for (const functionDir of functionDirs) {
            const functionDirPath = path.join(functionAppPath, functionDir);
            const stats = yield fse.lstat(functionDirPath);
            if (stats.isDirectory()) {
                for (const key of Object.keys(constants_1.ProjectLanguage)) {
                    const language = constants_1.ProjectLanguage[key];
                    const functionFileName = ScriptFunctionCreator_1.getScriptFileNameFromLanguage(language);
                    if (functionFileName && (yield fse.pathExists(path.join(functionDirPath, functionFileName)))) {
                        if (projectLanguage === undefined) {
                            projectLanguage = language;
                        }
                        else if (projectLanguage !== language) {
                            return undefined;
                        }
                    }
                }
            }
        }
        return projectLanguage;
    });
}
//# sourceMappingURL=detectProjectLanguage.js.map