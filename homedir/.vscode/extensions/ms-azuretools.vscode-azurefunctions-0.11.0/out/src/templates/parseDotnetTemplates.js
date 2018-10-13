"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../constants");
const IFunctionSetting_1 = require("./IFunctionSetting");
const IFunctionTemplate_1 = require("./IFunctionTemplate");
function parseDotnetSetting(rawSetting) {
    return {
        name: rawSetting.Name,
        resourceType: undefined,
        valueType: rawSetting.DataType === 'choice' ? IFunctionSetting_1.ValueType.enum : IFunctionSetting_1.ValueType.string,
        defaultValue: rawSetting.DefaultValue,
        label: rawSetting.Name,
        description: rawSetting.Documentation,
        enums: rawSetting.Choices ? Object.keys(rawSetting.Choices).map((key) => { return { value: key, displayName: key }; }) : [],
        validateSetting: () => { return undefined; } // Dotnet templates do not give us validation information
    };
}
function parseDotnetTemplate(rawTemplate) {
    const userPromptedSettings = [];
    for (const rawSetting of rawTemplate.Parameters) {
        const setting = parseDotnetSetting(rawSetting);
        // Exclude some of the default parameters like 'name' and 'namespace' that apply for every function and are handled separately
        if (!/^(name|namespace|type|language)$/i.test(setting.name)) {
            userPromptedSettings.push(setting);
        }
    }
    return {
        isHttpTrigger: rawTemplate.Name.toLowerCase().startsWith('http') || rawTemplate.Name.toLowerCase().endsWith('webhook'),
        id: rawTemplate.Identity,
        name: rawTemplate.Name,
        defaultFunctionName: rawTemplate.DefaultName,
        language: constants_1.ProjectLanguage.CSharp,
        userPromptedSettings: userPromptedSettings,
        categories: [IFunctionTemplate_1.TemplateCategory.Core] // Dotnet templates do not have category information, so display all templates as if they are in the 'core' category
    };
}
/**
 * Parses templates used by the .NET CLI
 * This basically converts the 'raw' templates in the externally defined JSON format to a common and understood format (IFunctionTemplate) used by this extension
 */
function parseDotnetTemplates(rawTemplates, runtime) {
    const templates = [];
    for (const rawTemplate of rawTemplates) {
        try {
            const template = parseDotnetTemplate(rawTemplate);
            if (template.id.startsWith('Azure.Function.CSharp.') &&
                ((runtime === constants_1.ProjectRuntime.v1 && template.id.includes('1')) || (runtime === constants_1.ProjectRuntime.v2 && template.id.includes('2')))) {
                templates.push(template);
            }
        }
        catch (error) {
            // Ignore errors so that a single poorly formed template does not affect other templates
        }
    }
    return templates;
}
exports.parseDotnetTemplates = parseDotnetTemplates;
//# sourceMappingURL=parseDotnetTemplates.js.map