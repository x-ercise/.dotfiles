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
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const constants_1 = require("../constants");
const extensionVariables_1 = require("../extensionVariables");
const localize_1 = require("../localize");
const ProjectSettings_1 = require("../ProjectSettings");
const getCliFeedJson_1 = require("../utils/getCliFeedJson");
const DotnetTemplateRetriever_1 = require("./DotnetTemplateRetriever");
const IFunctionTemplate_1 = require("./IFunctionTemplate");
const parseJavaTemplates_1 = require("./parseJavaTemplates");
const ScriptTemplateRetriever_1 = require("./ScriptTemplateRetriever");
const TemplateRetriever_1 = require("./TemplateRetriever");
class FunctionTemplates {
    constructor(templatesMap) {
        this._templatesMap = {};
        // if there are no templates, then there is likely no internet or a problem with the clifeed url
        this._noInternetErrMsg = localize_1.localize('retryInternet', 'There was an error in retrieving the templates.  Recheck your internet connection and try again.');
        this._templatesMap = templatesMap;
        this.copyCSharpSettingsFromJS();
    }
    getTemplates(language, runtime, functionAppPath, templateFilter, telemetryProperties) {
        return __awaiter(this, void 0, void 0, function* () {
            const templates = this._templatesMap[runtime];
            if (!templates) {
                throw new Error(this._noInternetErrMsg);
            }
            if (language === constants_1.ProjectLanguage.Java) {
                return yield parseJavaTemplates_1.parseJavaTemplates(templates, functionAppPath, telemetryProperties);
            }
            else {
                let filterTemplates = templates.filter((t) => t.language.toLowerCase() === language.toLowerCase());
                switch (templateFilter) {
                    case constants_1.TemplateFilter.All:
                        break;
                    case constants_1.TemplateFilter.Core:
                        filterTemplates = filterTemplates.filter((t) => t.categories.find((c) => c === IFunctionTemplate_1.TemplateCategory.Core) !== undefined);
                        break;
                    case constants_1.TemplateFilter.Verified:
                    default:
                        const verifiedTemplateIds = ScriptTemplateRetriever_1.getScriptVerifiedTemplateIds(runtime).concat(DotnetTemplateRetriever_1.getDotnetVerifiedTemplateIds(runtime));
                        filterTemplates = filterTemplates.filter((t) => verifiedTemplateIds.find((vt) => vt === t.id));
                }
                return filterTemplates;
            }
        });
    }
    /**
     * The dotnet templates do not provide the validation and resourceType information that we desire
     * As a workaround, we can check for the exact same JavaScript template/setting and leverage that information
     */
    copyCSharpSettingsFromJS() {
        for (const key of Object.keys(this._templatesMap)) {
            const templates = this._templatesMap[key];
            if (templates) {
                const jsTemplates = templates.filter((t) => t.language.toLowerCase() === constants_1.ProjectLanguage.JavaScript.toLowerCase());
                const csharpTemplates = templates.filter((t) => t.language.toLowerCase() === constants_1.ProjectLanguage.CSharp.toLowerCase());
                for (const csharpTemplate of csharpTemplates) {
                    const jsTemplate = jsTemplates.find((t) => normalizeName(t.name) === normalizeName(csharpTemplate.name));
                    if (jsTemplate) {
                        for (const cSharpSetting of csharpTemplate.userPromptedSettings) {
                            const jsSetting = jsTemplate.userPromptedSettings.find((t) => normalizeName(t.name) === normalizeName(cSharpSetting.name));
                            if (jsSetting) {
                                cSharpSetting.resourceType = jsSetting.resourceType;
                                cSharpSetting.validateSetting = jsSetting.validateSetting;
                            }
                        }
                    }
                }
            }
        }
    }
}
exports.FunctionTemplates = FunctionTemplates;
function normalizeName(name) {
    return name.toLowerCase().replace(/\s/g, '');
}
function getFunctionTemplates() {
    return __awaiter(this, void 0, void 0, function* () {
        const templatesMap = {};
        const cliFeedJson = yield getCliFeedJson_1.tryGetCliFeedJson();
        const templateRetrievers = [new ScriptTemplateRetriever_1.ScriptTemplateRetriever(), new DotnetTemplateRetriever_1.DotnetTemplateRetriever()];
        for (const templateRetriever of templateRetrievers) {
            for (const key of Object.keys(constants_1.ProjectRuntime)) {
                const runtime = constants_1.ProjectRuntime[key];
                yield vscode_azureextensionui_1.callWithTelemetryAndErrorHandling('azureFunctions.getFunctionTemplates', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        this.suppressErrorDisplay = true;
                        this.properties.isActivationEvent = 'true';
                        this.properties.runtime = runtime;
                        this.properties.templateType = templateRetriever.templateType;
                        const templateVersion = yield tryGetTemplateVersionSetting(this, cliFeedJson, runtime);
                        let templates;
                        // 1. Use the cached templates if they match templateVersion
                        if (extensionVariables_1.ext.context.globalState.get(templateRetriever.getCacheKey(TemplateRetriever_1.TemplateRetriever.templateVersionKey, runtime)) === templateVersion) {
                            templates = yield templateRetriever.tryGetTemplatesFromCache(this, runtime);
                            this.properties.templateSource = 'matchingCache';
                        }
                        // 2. Download templates from the cli-feed if the cache doesn't match templateVersion
                        if (!templates && cliFeedJson && templateVersion) {
                            templates = yield templateRetriever.tryGetTemplatesFromCliFeed(this, cliFeedJson, templateVersion, runtime);
                            this.properties.templateSource = 'cliFeed';
                        }
                        // 3. Use the cached templates, even if they don't match templateVersion
                        if (!templates) {
                            templates = yield templateRetriever.tryGetTemplatesFromCache(this, runtime);
                            this.properties.templateSource = 'mismatchCache';
                        }
                        // 4. Use backup templates shipped with the extension
                        if (!templates) {
                            templates = yield templateRetriever.tryGetTemplatesFromBackup(this, runtime);
                            this.properties.templateSource = 'backupFromExtension';
                        }
                        if (templates) {
                            // tslint:disable-next-line:strict-boolean-expressions
                            templatesMap[runtime] = (templatesMap[runtime] || []).concat(templates);
                        }
                        else {
                            // Failed to get templates for this runtime
                            this.properties.templateSource = 'None';
                        }
                    });
                });
            }
        }
        return new FunctionTemplates(templatesMap);
    });
}
exports.getFunctionTemplates = getFunctionTemplates;
function removeLanguageFromId(id) {
    return id.split('-')[0];
}
exports.removeLanguageFromId = removeLanguageFromId;
function tryGetTemplateVersionSetting(context, cliFeedJson, runtime) {
    return __awaiter(this, void 0, void 0, function* () {
        const feedRuntime = getCliFeedJson_1.getFeedRuntime(runtime);
        const userTemplateVersion = ProjectSettings_1.getFuncExtensionSetting(constants_1.templateVersionSetting);
        try {
            if (userTemplateVersion) {
                context.properties.userTemplateVersion = userTemplateVersion;
            }
            let templateVersion;
            if (cliFeedJson) {
                templateVersion = userTemplateVersion ? userTemplateVersion : cliFeedJson.tags[feedRuntime].release;
                // tslint:disable-next-line:strict-boolean-expressions
                if (!cliFeedJson.releases[templateVersion]) {
                    const invalidVersion = localize_1.localize('invalidTemplateVersion', 'Failed to retrieve Azure Functions templates for version "{0}".', templateVersion);
                    const selectVersion = { title: localize_1.localize('selectVersion', 'Select version') };
                    const useLatest = { title: localize_1.localize('useLatest', 'Use latest') };
                    const warningInput = yield extensionVariables_1.ext.ui.showWarningMessage(invalidVersion, selectVersion, useLatest);
                    if (warningInput === selectVersion) {
                        const releaseQuickPicks = [];
                        for (const rel of Object.keys(cliFeedJson.releases)) {
                            releaseQuickPicks.push({
                                label: rel,
                                description: ''
                            });
                        }
                        const input = yield extensionVariables_1.ext.ui.showQuickPick(releaseQuickPicks, { placeHolder: invalidVersion });
                        templateVersion = input.label;
                        yield ProjectSettings_1.updateGlobalSetting(constants_1.templateVersionSetting, input.label);
                    }
                    else {
                        templateVersion = cliFeedJson.tags[feedRuntime].release;
                        // reset user setting so that it always gets latest
                        yield ProjectSettings_1.updateGlobalSetting(constants_1.templateVersionSetting, '');
                    }
                }
            }
            else {
                return undefined;
            }
            return templateVersion;
        }
        catch (error) {
            // if cliJson does not have the template version being searched for, it will throw an error
            context.properties.userTemplateVersion = vscode_azureextensionui_1.parseError(error).message;
            return undefined;
        }
    });
}
//# sourceMappingURL=FunctionTemplates.js.map