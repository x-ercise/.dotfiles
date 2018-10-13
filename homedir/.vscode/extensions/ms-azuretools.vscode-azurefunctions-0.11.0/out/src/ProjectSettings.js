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
// tslint:disable-next-line:no-require-imports
const opn = require("opn");
const path = require("path");
const vscode = require("vscode");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const constants_1 = require("./constants");
const extensionVariables_1 = require("./extensionVariables");
const localize_1 = require("./localize");
const previewDescription = localize_1.localize('previewDescription', '(Preview)');
function updateGlobalSetting(section, value) {
    return __awaiter(this, void 0, void 0, function* () {
        const projectConfiguration = vscode.workspace.getConfiguration(constants_1.extensionPrefix);
        yield projectConfiguration.update(section, value, vscode.ConfigurationTarget.Global);
    });
}
exports.updateGlobalSetting = updateGlobalSetting;
function updateWorkspaceSetting(section, value, fsPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const projectConfiguration = vscode.workspace.getConfiguration(constants_1.extensionPrefix, vscode.Uri.file(fsPath));
        yield projectConfiguration.update(section, value);
    });
}
exports.updateWorkspaceSetting = updateWorkspaceSetting;
function promptForProjectLanguage(ui) {
    return __awaiter(this, void 0, void 0, function* () {
        const picks = [
            { label: constants_1.ProjectLanguage.JavaScript, description: '' },
            { label: constants_1.ProjectLanguage.CSharp, description: '' },
            { label: constants_1.ProjectLanguage.CSharpScript, description: '' },
            { label: constants_1.ProjectLanguage.FSharpScript, description: '' },
            { label: constants_1.ProjectLanguage.Bash, description: previewDescription },
            { label: constants_1.ProjectLanguage.Batch, description: previewDescription },
            { label: constants_1.ProjectLanguage.Java, description: previewDescription },
            { label: constants_1.ProjectLanguage.PHP, description: previewDescription },
            { label: constants_1.ProjectLanguage.PowerShell, description: previewDescription },
            { label: constants_1.ProjectLanguage.Python, description: previewDescription },
            { label: constants_1.ProjectLanguage.TypeScript, description: previewDescription }
        ];
        const options = { placeHolder: localize_1.localize('selectLanguage', 'Select a language') };
        return (yield ui.showQuickPick(picks, options)).label;
    });
}
exports.promptForProjectLanguage = promptForProjectLanguage;
function promptForProjectRuntime(message) {
    return __awaiter(this, void 0, void 0, function* () {
        const picks = [
            { label: 'Azure Functions v2', description: '(.NET Standard)', data: constants_1.ProjectRuntime.v2 },
            { label: 'Azure Functions v1', description: '(.NET Framework)', data: constants_1.ProjectRuntime.v1 },
            { label: localize_1.localize('learnMore', 'Learn more...'), description: '', data: undefined }
        ];
        const options = { placeHolder: message || localize_1.localize('selectRuntime', 'Select a runtime'), suppressPersistence: true };
        let runtime;
        do {
            runtime = (yield extensionVariables_1.ext.ui.showQuickPick(picks, options)).data;
            if (runtime === undefined) {
                // don't wait to re-show dialog
                // tslint:disable-next-line:no-floating-promises
                opn('https://aka.ms/AA1tpij');
            }
        } while (runtime === undefined);
        return runtime;
    });
}
exports.promptForProjectRuntime = promptForProjectRuntime;
function selectTemplateFilter(projectPath, ui) {
    return __awaiter(this, void 0, void 0, function* () {
        const picks = [
            { label: constants_1.TemplateFilter.Verified, description: localize_1.localize('verifiedDescription', '(Subset of "Core" that has been verified in VS Code)') },
            { label: constants_1.TemplateFilter.Core, description: '' },
            { label: constants_1.TemplateFilter.All, description: '' }
        ];
        const options = { placeHolder: localize_1.localize('selectFilter', 'Select a template filter') };
        const result = (yield ui.showQuickPick(picks, options)).label;
        yield updateWorkspaceSetting(constants_1.templateFilterSetting, result, projectPath);
        return result;
    });
}
exports.selectTemplateFilter = selectTemplateFilter;
function getGlobalFuncExtensionSetting(key) {
    const projectConfiguration = vscode.workspace.getConfiguration(constants_1.extensionPrefix);
    const result = projectConfiguration.inspect(key);
    return result && result.globalValue;
}
exports.getGlobalFuncExtensionSetting = getGlobalFuncExtensionSetting;
function getFuncExtensionSetting(key, fsPath) {
    const projectConfiguration = vscode.workspace.getConfiguration(constants_1.extensionPrefix, fsPath ? vscode.Uri.file(fsPath) : undefined);
    return projectConfiguration.get(key);
}
exports.getFuncExtensionSetting = getFuncExtensionSetting;
function getProjectLanguage(projectPath, ui) {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield fse.pathExists(path.join(projectPath, 'pom.xml'))) {
            return constants_1.ProjectLanguage.Java;
        }
        else {
            let language = getFuncExtensionSetting(constants_1.projectLanguageSetting, projectPath);
            if (!language) {
                const message = localize_1.localize('noLanguage', 'You must have a project language set to perform this operation.');
                const selectLanguage = { title: localize_1.localize('selectLanguageButton', 'Select Language') };
                yield ui.showWarningMessage(message, { modal: true }, selectLanguage, vscode_azureextensionui_1.DialogResponses.cancel);
                language = yield promptForProjectLanguage(ui);
                yield updateWorkspaceSetting(constants_1.projectLanguageSetting, language, projectPath);
            }
            return language;
        }
    });
}
exports.getProjectLanguage = getProjectLanguage;
function getProjectRuntime(language, projectPath, ui) {
    return __awaiter(this, void 0, void 0, function* () {
        if (language === constants_1.ProjectLanguage.Java) {
            // Java only supports v2
            return constants_1.ProjectRuntime.v2;
        }
        let runtime = convertStringToRuntime(getFuncExtensionSetting(constants_1.projectRuntimeSetting, projectPath));
        if (!runtime) {
            const message = localize_1.localize('noRuntime', 'You must have a project runtime set to perform this operation.');
            const selectRuntime = { title: localize_1.localize('selectRuntimeButton', 'Select Runtime') };
            yield ui.showWarningMessage(message, { modal: true }, selectRuntime, vscode_azureextensionui_1.DialogResponses.cancel);
            runtime = yield promptForProjectRuntime();
            yield updateWorkspaceSetting(constants_1.projectRuntimeSetting, runtime, projectPath);
        }
        return runtime;
    });
}
exports.getProjectRuntime = getProjectRuntime;
function getTemplateFilter(projectPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const templateFilter = getFuncExtensionSetting(constants_1.templateFilterSetting, projectPath);
        return templateFilter ? templateFilter : constants_1.TemplateFilter.Verified;
    });
}
exports.getTemplateFilter = getTemplateFilter;
/**
 * Special notes due to recent GA of v2 (~Sept 2018):
 * We have to support 'beta' as 'v2' since it's so commonly used. We should remove this support eventually since 'beta' will probably change meaning if there's ever a v3.
 * We no longer support 'latest'. That value is not recommended, not commonly used, and is changing meaning from v1 to v2. Better to just act like we don't recognize it.
 * https://github.com/Microsoft/vscode-azurefunctions/issues/562
 */
function convertStringToRuntime(rawRuntime) {
    rawRuntime = rawRuntime ? rawRuntime.toLowerCase() : '';
    if (/^~?1.*/.test(rawRuntime)) {
        return constants_1.ProjectRuntime.v1;
    }
    else if (/^~?2.*/.test(rawRuntime) || rawRuntime === 'beta') {
        return constants_1.ProjectRuntime.v2;
    }
    else {
        // Return undefined if we don't recognize the runtime
        return undefined;
    }
}
exports.convertStringToRuntime = convertStringToRuntime;
//# sourceMappingURL=ProjectSettings.js.map