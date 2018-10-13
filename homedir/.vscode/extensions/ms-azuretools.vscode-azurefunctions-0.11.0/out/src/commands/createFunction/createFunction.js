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
const util_1 = require("util");
const vscode = require("vscode");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const constants_1 = require("../../constants");
const extensionVariables_1 = require("../../extensionVariables");
const LocalAppSettings_1 = require("../../LocalAppSettings");
const localize_1 = require("../../localize");
const ProjectSettings_1 = require("../../ProjectSettings");
const IFunctionSetting_1 = require("../../templates/IFunctionSetting");
const workspaceUtil = require("../../utils/workspace");
const createNewProject_1 = require("../createNewProject/createNewProject");
const validateFunctionProjects_1 = require("../createNewProject/validateFunctionProjects");
const CSharpFunctionCreator_1 = require("./CSharpFunctionCreator");
const JavaFunctionCreator_1 = require("./JavaFunctionCreator");
const ScriptFunctionCreator_1 = require("./ScriptFunctionCreator");
function promptForSetting(actionContext, localSettingsPath, setting) {
    return __awaiter(this, void 0, void 0, function* () {
        if (setting.resourceType !== undefined) {
            return yield LocalAppSettings_1.promptForAppSetting(actionContext, localSettingsPath, setting.resourceType);
        }
        else {
            switch (setting.valueType) {
                case IFunctionSetting_1.ValueType.boolean:
                    return yield promptForBooleanSetting(setting);
                case IFunctionSetting_1.ValueType.enum:
                    return yield promptForEnumSetting(setting);
                default:
                    // Default to 'string' type for any setting that isn't supported
                    return yield promptForStringSetting(setting);
            }
        }
    });
}
function promptForEnumSetting(setting) {
    return __awaiter(this, void 0, void 0, function* () {
        const picks = setting.enums.map((ev) => { return { data: ev.value, label: ev.displayName, description: '' }; });
        return (yield extensionVariables_1.ext.ui.showQuickPick(picks, { placeHolder: setting.label })).data;
    });
}
function promptForBooleanSetting(setting) {
    return __awaiter(this, void 0, void 0, function* () {
        const picks = [
            { label: 'true', description: '' },
            { label: 'false', description: '' }
        ];
        return (yield extensionVariables_1.ext.ui.showQuickPick(picks, { placeHolder: setting.label })).label;
    });
}
function promptForStringSetting(setting) {
    return __awaiter(this, void 0, void 0, function* () {
        const options = {
            placeHolder: setting.label,
            prompt: setting.description || localize_1.localize('azFunc.stringSettingPrompt', 'Provide a \'{0}\'', setting.label),
            validateInput: (s) => setting.validateSetting(s),
            value: setting.defaultValue
        };
        return yield extensionVariables_1.ext.ui.showInputBox(options);
    });
}
// tslint:disable-next-line:max-func-body-length
function createFunction(actionContext, functionAppPath, templateId, functionName, caseSensitiveFunctionSettings, language, runtime) {
    return __awaiter(this, void 0, void 0, function* () {
        const functionSettings = {};
        if (caseSensitiveFunctionSettings) {
            Object.keys(caseSensitiveFunctionSettings).forEach((key) => functionSettings[key.toLowerCase()] = caseSensitiveFunctionSettings[key]);
        }
        if (functionAppPath === undefined) {
            const folderPlaceholder = localize_1.localize('azFunc.selectFunctionAppFolderExisting', 'Select the folder containing your function app');
            functionAppPath = yield workspaceUtil.selectWorkspaceFolder(extensionVariables_1.ext.ui, folderPlaceholder);
        }
        let isNewProject = false;
        let templateFilter;
        if (!(yield validateFunctionProjects_1.isFunctionProject(functionAppPath))) {
            const message = localize_1.localize('azFunc.notFunctionApp', 'The selected folder is not a function app project. Initialize Project?');
            const result = yield extensionVariables_1.ext.ui.showWarningMessage(message, { modal: true }, vscode_azureextensionui_1.DialogResponses.yes, vscode_azureextensionui_1.DialogResponses.skipForNow, vscode_azureextensionui_1.DialogResponses.cancel);
            if (result === vscode_azureextensionui_1.DialogResponses.yes) {
                yield createNewProject_1.createNewProject(actionContext, functionAppPath, undefined, undefined, false);
                isNewProject = true;
                // Get the settings used to create the project
                language = actionContext.properties.projectLanguage;
                runtime = actionContext.properties.projectRuntime;
                templateFilter = actionContext.properties.templateFilter;
            }
        }
        const localSettingsPath = path.join(functionAppPath, constants_1.localSettingsFileName);
        if (language === undefined) {
            language = yield ProjectSettings_1.getProjectLanguage(functionAppPath, extensionVariables_1.ext.ui);
        }
        if (runtime === undefined) {
            runtime = yield ProjectSettings_1.getProjectRuntime(language, functionAppPath, extensionVariables_1.ext.ui);
        }
        let template;
        if (!templateId) {
            templateFilter = yield ProjectSettings_1.getTemplateFilter(functionAppPath);
            [template, language, runtime, templateFilter] = yield promptForTemplate(functionAppPath, language, runtime, templateFilter, actionContext.properties);
        }
        else {
            templateFilter = constants_1.TemplateFilter.All;
            const templates = yield extensionVariables_1.ext.functionTemplates.getTemplates(language, runtime, functionAppPath, constants_1.TemplateFilter.All, actionContext.properties);
            const foundTemplate = templates.find((t) => t.id === templateId);
            if (foundTemplate) {
                template = foundTemplate;
            }
            else {
                throw new Error(localize_1.localize('templateNotFound', 'Could not find template with language "{0}", runtime "{1}", and id "{2}".', language, runtime, templateId));
            }
        }
        actionContext.properties.projectLanguage = language;
        actionContext.properties.projectRuntime = runtime;
        actionContext.properties.templateFilter = templateFilter;
        actionContext.properties.templateId = template.id;
        let functionCreator;
        switch (language) {
            case constants_1.ProjectLanguage.Java:
                functionCreator = new JavaFunctionCreator_1.JavaFunctionCreator(functionAppPath, template, extensionVariables_1.ext.outputChannel, actionContext);
                break;
            case constants_1.ProjectLanguage.CSharp:
                functionCreator = new CSharpFunctionCreator_1.CSharpFunctionCreator(functionAppPath, template);
                break;
            default:
                functionCreator = new ScriptFunctionCreator_1.ScriptFunctionCreator(functionAppPath, template, language);
                break;
        }
        yield functionCreator.promptForSettings(extensionVariables_1.ext.ui, functionName, functionSettings);
        const userSettings = {};
        for (const setting of template.userPromptedSettings) {
            let settingValue;
            if (functionSettings[setting.name.toLowerCase()] !== undefined) {
                settingValue = functionSettings[setting.name.toLowerCase()];
            }
            else {
                settingValue = yield promptForSetting(actionContext, localSettingsPath, setting);
            }
            userSettings[setting.name] = settingValue ? settingValue : '';
        }
        const newFilePath = yield functionCreator.createFunction(userSettings, runtime);
        if (newFilePath && (yield fse.pathExists(newFilePath))) {
            const newFileUri = vscode.Uri.file(newFilePath);
            vscode.window.showTextDocument(yield vscode.workspace.openTextDocument(newFileUri));
        }
        if (!template.isHttpTrigger) {
            yield LocalAppSettings_1.validateAzureWebJobsStorage(actionContext, localSettingsPath);
        }
        if (isNewProject) {
            yield workspaceUtil.ensureFolderIsOpen(functionAppPath, actionContext);
        }
    });
}
exports.createFunction = createFunction;
function promptForTemplate(functionAppPath, language, runtime, templateFilter, telemetryProperties) {
    return __awaiter(this, void 0, void 0, function* () {
        const runtimePickId = 'runtime';
        const languagePickId = 'language';
        const filterPickId = 'filter';
        let template;
        while (!template) {
            const templates = yield extensionVariables_1.ext.functionTemplates.getTemplates(language, runtime, functionAppPath, templateFilter, telemetryProperties);
            let picks = templates.map((t) => { return { data: t, label: t.name, description: '' }; });
            picks = picks.concat([
                { label: localize_1.localize('selectRuntime', '$(gear) Change project runtime'), description: localize_1.localize('currentRuntime', 'Current: {0}', runtime), data: runtimePickId, suppressPersistence: true },
                { label: localize_1.localize('selectLanguage', '$(gear) Change project language'), description: localize_1.localize('currentLanguage', 'Current: {0}', language), data: languagePickId, suppressPersistence: true },
                { label: localize_1.localize('selectFilter', '$(gear) Change template filter'), description: localize_1.localize('currentFilter', 'Current: {0}', templateFilter), data: filterPickId, suppressPersistence: true }
            ]);
            const placeHolder = templates.length > 0 ? localize_1.localize('azFunc.selectFuncTemplate', 'Select a function template') : localize_1.localize('azFunc.noTemplatesFound', 'No templates found. Change your settings to view more templates');
            const result = (yield extensionVariables_1.ext.ui.showQuickPick(picks, { placeHolder })).data;
            if (util_1.isString(result)) {
                switch (result) {
                    case runtimePickId:
                        runtime = yield ProjectSettings_1.promptForProjectRuntime();
                        yield ProjectSettings_1.updateWorkspaceSetting(constants_1.projectRuntimeSetting, runtime, functionAppPath);
                        break;
                    case languagePickId:
                        language = yield ProjectSettings_1.promptForProjectLanguage(extensionVariables_1.ext.ui);
                        yield ProjectSettings_1.updateWorkspaceSetting(constants_1.projectLanguageSetting, language, functionAppPath);
                        break;
                    default:
                        templateFilter = yield ProjectSettings_1.selectTemplateFilter(functionAppPath, extensionVariables_1.ext.ui);
                        break;
                }
            }
            else {
                template = result;
            }
        }
        return [template, language, runtime, templateFilter];
    });
}
//# sourceMappingURL=createFunction.js.map