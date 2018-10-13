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
const localize_1 = require("../../localize");
const fsUtil = require("../../utils/fs");
const FunctionCreatorBase_1 = require("./FunctionCreatorBase");
function getScriptFileNameFromLanguage(language) {
    switch (language) {
        case constants_1.ProjectLanguage.Bash:
            return 'run.sh';
        case constants_1.ProjectLanguage.Batch:
            return 'run.bat';
        case constants_1.ProjectLanguage.CSharpScript:
            return 'run.csx';
        case constants_1.ProjectLanguage.FSharpScript:
            return 'run.fsx';
        case constants_1.ProjectLanguage.JavaScript:
            return 'index.js';
        case constants_1.ProjectLanguage.PHP:
            return 'run.php';
        case constants_1.ProjectLanguage.PowerShell:
            return 'run.ps1';
        case constants_1.ProjectLanguage.Python:
            return '__init__.py';
        case constants_1.ProjectLanguage.TypeScript:
            return 'index.ts';
        default:
            return undefined;
    }
}
exports.getScriptFileNameFromLanguage = getScriptFileNameFromLanguage;
/**
 * Function creator for multiple languages that don't require compilation (JavaScript, C# Script, Bash, etc.)
 */
class ScriptFunctionCreator extends FunctionCreatorBase_1.FunctionCreatorBase {
    constructor(functionAppPath, template, language) {
        super(functionAppPath, template);
        this._language = language;
    }
    promptForSettings(ui, functionName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!functionName) {
                const defaultFunctionName = yield fsUtil.getUniqueFsPath(this._functionAppPath, this._template.defaultFunctionName);
                this._functionName = yield ui.showInputBox({
                    placeHolder: localize_1.localize('azFunc.funcNamePlaceholder', 'Function name'),
                    prompt: localize_1.localize('azFunc.funcNamePrompt', 'Provide a function name'),
                    validateInput: (s) => this.validateTemplateName(s),
                    value: defaultFunctionName || this._template.defaultFunctionName
                });
            }
            else {
                this._functionName = functionName;
            }
        });
    }
    createFunction(userSettings) {
        return __awaiter(this, void 0, void 0, function* () {
            const functionPath = path.join(this._functionAppPath, this._functionName);
            yield fse.ensureDir(functionPath);
            yield Promise.all(Object.keys(this._template.templateFiles).map((fileName) => __awaiter(this, void 0, void 0, function* () {
                yield fse.writeFile(path.join(functionPath, fileName), this._template.templateFiles[fileName]);
            })));
            for (const key of Object.keys(userSettings)) {
                this._template.functionConfig.inBinding[key] = userSettings[key];
            }
            yield fsUtil.writeFormattedJson(path.join(functionPath, 'function.json'), this._template.functionConfig.functionJson);
            const mainFileName = getScriptFileNameFromLanguage(this._language);
            if (mainFileName) {
                return path.join(functionPath, mainFileName);
            }
            else {
                return undefined;
            }
        });
    }
    validateTemplateName(name) {
        if (!name) {
            return localize_1.localize('azFunc.emptyTemplateNameError', 'The template name cannot be empty.');
        }
        else if (fse.existsSync(path.join(this._functionAppPath, name))) {
            return localize_1.localize('azFunc.existingFolderError', 'A folder with the name \'{0}\' already exists.', name);
        }
        else if (!this._functionNameRegex.test(name)) {
            return localize_1.localize('azFunc.functionNameInvalidError', 'Function name must start with a letter and can contain letters, digits, \'_\' and \'-\'');
        }
        else {
            return undefined;
        }
    }
}
exports.ScriptFunctionCreator = ScriptFunctionCreator;
//# sourceMappingURL=ScriptFunctionCreator.js.map