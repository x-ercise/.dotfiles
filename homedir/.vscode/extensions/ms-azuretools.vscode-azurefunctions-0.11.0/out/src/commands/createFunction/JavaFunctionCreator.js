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
const localize_1 = require("../../localize");
const FunctionTemplates_1 = require("../../templates/FunctionTemplates");
const fsUtil = require("../../utils/fs");
const javaNameUtils_1 = require("../../utils/javaNameUtils");
const mavenUtils_1 = require("../../utils/mavenUtils");
const FunctionCreatorBase_1 = require("./FunctionCreatorBase");
function getNewJavaFunctionFilePath(functionAppPath, packageName, functionName) {
    return path.join(functionAppPath, 'src', 'main', 'java', ...packageName.split('.'), `${javaNameUtils_1.parseJavaClassName(functionName)}.java`);
}
class JavaFunctionCreator extends FunctionCreatorBase_1.FunctionCreatorBase {
    constructor(functionAppPath, template, outputChannel, actionContext) {
        super(functionAppPath, template);
        this._outputChannel = outputChannel;
        this._actionContext = actionContext;
    }
    promptForSettings(ui, functionName) {
        return __awaiter(this, void 0, void 0, function* () {
            this._packageName = yield ui.showInputBox({
                placeHolder: localize_1.localize('azFunc.java.packagePlaceHolder', 'Package'),
                prompt: localize_1.localize('azFunc.java.packagePrompt', 'Provide a package name'),
                validateInput: javaNameUtils_1.validatePackageName,
                value: 'com.function'
            });
            if (!functionName) {
                const defaultFunctionName = yield fsUtil.getUniqueJavaFsPath(this._functionAppPath, this._packageName, `${FunctionTemplates_1.removeLanguageFromId(this._template.id)}Java`);
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
            const javaFuntionProperties = [];
            for (const key of Object.keys(userSettings)) {
                javaFuntionProperties.push(mavenUtils_1.mavenUtils.formatMavenArg(`D${key}`, userSettings[key]));
            }
            yield mavenUtils_1.mavenUtils.validateMavenInstalled(this._actionContext, this._functionAppPath);
            this._outputChannel.show();
            yield mavenUtils_1.mavenUtils.executeMvnCommand(this._actionContext.properties, this._outputChannel, this._functionAppPath, 'azure-functions:add', '-B', mavenUtils_1.mavenUtils.formatMavenArg('Dfunctions.package', this._packageName), mavenUtils_1.mavenUtils.formatMavenArg('Dfunctions.name', this._functionName), mavenUtils_1.mavenUtils.formatMavenArg('Dfunctions.template', FunctionTemplates_1.removeLanguageFromId(this._template.id)), ...javaFuntionProperties);
            return getNewJavaFunctionFilePath(this._functionAppPath, this._packageName, this._functionName);
        });
    }
    validateTemplateName(name) {
        if (!name) {
            return localize_1.localize('azFunc.emptyTemplateNameError', 'The template name cannot be empty.');
        }
        else if (fse.existsSync(getNewJavaFunctionFilePath(this._functionAppPath, this._packageName, name))) {
            return localize_1.localize('azFunc.existingFolderError', 'The Java class \'{0}\' already exists.', javaNameUtils_1.getFullClassName(this._packageName, name));
        }
        else if (!this._functionNameRegex.test(name)) {
            return localize_1.localize('azFunc.functionNameInvalidError', 'Function name must start with a letter and can contain letters, digits, \'_\' and \'-\'');
        }
        else {
            return undefined;
        }
    }
}
exports.JavaFunctionCreator = JavaFunctionCreator;
//# sourceMappingURL=JavaFunctionCreator.js.map