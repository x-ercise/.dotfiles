"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
const constants_1 = require("../constants");
const FunctionConfig_1 = require("../FunctionConfig");
// tslint:disable-next-line:no-any
function getVariableValue(resources, variables, data) {
    if (!util_1.isString(data)) {
        // This evaluates to a non-string value in rare cases, in which case we just return the value as-is
        return data;
    }
    const matches = data.match(/\[variables\(\'(.*)\'\)\]/);
    data = matches !== null ? variables[matches[1]] : data;
    return getResourceValue(resources, data);
}
function getResourceValue(resources, data) {
    const matches = data.match(/\$(.*)/);
    return matches !== null ? resources.en[matches[1]] : data;
}
exports.getResourceValue = getResourceValue;
function parseScriptSetting(data, resources, variables) {
    const rawSetting = data;
    const enums = [];
    if (rawSetting.enum) {
        for (const ev of rawSetting.enum) {
            enums.push({
                value: getVariableValue(resources, variables, ev.value),
                displayName: getVariableValue(resources, variables, ev.display)
            });
        }
    }
    return {
        name: getVariableValue(resources, variables, rawSetting.name),
        resourceType: rawSetting.resource,
        valueType: rawSetting.value,
        defaultValue: rawSetting.defaultValue ? getVariableValue(resources, variables, rawSetting.defaultValue) : undefined,
        label: getVariableValue(resources, variables, rawSetting.label),
        enums: enums,
        validateSetting: (value) => {
            if (rawSetting.validators) {
                for (const validator of rawSetting.validators) {
                    if (!value || value.match(validator.expression) === null) {
                        return getVariableValue(resources, variables, validator.errorText);
                    }
                }
            }
            return undefined;
        }
    };
}
function parseScriptTemplate(rawTemplate, resources, commonSettings) {
    const commonSettingsMap = {};
    for (const binding of commonSettings.bindings) {
        commonSettingsMap[binding.type] = binding.settings.map((setting) => parseScriptSetting(setting, resources, commonSettings.variables));
    }
    const functionConfig = new FunctionConfig_1.FunctionConfig(rawTemplate.function);
    let language = rawTemplate.metadata.language;
    // The templateApiZip only supports script languages, and thus incorrectly defines 'C#Script' as 'C#', etc.
    switch (language) {
        case constants_1.ProjectLanguage.CSharp:
            language = constants_1.ProjectLanguage.CSharpScript;
            break;
        case constants_1.ProjectLanguage.FSharp:
            language = constants_1.ProjectLanguage.FSharpScript;
            break;
        // The schema of Java templates is the same as script languages, so put it here.
        case constants_1.ProjectLanguage.Java:
            language = constants_1.ProjectLanguage.Java;
            break;
        default:
    }
    const userPromptedSettings = [];
    if (rawTemplate.metadata.userPrompt) {
        for (const settingName of rawTemplate.metadata.userPrompt) {
            const settings = commonSettingsMap[functionConfig.inBindingType];
            if (settings) {
                const setting = settings.find((bs) => bs.name === settingName);
                if (setting) {
                    const functionSpecificDefaultValue = functionConfig.inBinding[setting.name];
                    if (functionSpecificDefaultValue) {
                        // overwrite common default value with the function-specific default value
                        setting.defaultValue = functionSpecificDefaultValue;
                    }
                    userPromptedSettings.push(setting);
                }
            }
        }
    }
    return {
        functionConfig: functionConfig,
        isHttpTrigger: functionConfig.isHttpTrigger,
        id: rawTemplate.id,
        functionType: functionConfig.inBindingType,
        name: getResourceValue(resources, rawTemplate.metadata.name),
        defaultFunctionName: rawTemplate.metadata.defaultFunctionName,
        language: language,
        userPromptedSettings: userPromptedSettings,
        templateFiles: rawTemplate.files,
        categories: rawTemplate.metadata.category
    };
}
exports.parseScriptTemplate = parseScriptTemplate;
/**
 * Parses templates contained in the templateApiZip of the functions cli feed. This contains all 'script' templates, including JavaScript, C#Script, Python, etc.
 * This basically converts the 'raw' templates in the externally defined JSON format to a common and understood format (IFunctionTemplate) used by this extension
 */
function parseScriptTemplates(rawResources, rawTemplates, rawConfig) {
    const templates = [];
    for (const rawTemplate of rawTemplates) {
        try {
            templates.push(parseScriptTemplate(rawTemplate, rawResources, rawConfig));
        }
        catch (error) {
            // Ignore errors so that a single poorly formed template does not affect other templates
        }
    }
    return templates;
}
exports.parseScriptTemplates = parseScriptTemplates;
//# sourceMappingURL=parseScriptTemplates.js.map