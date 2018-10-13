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
const mavenUtils_1 = require("../utils/mavenUtils");
const FunctionTemplates_1 = require("./FunctionTemplates");
const parseScriptTemplates_1 = require("./parseScriptTemplates");
const backupJavaTemplateNames = [
    'HttpTrigger',
    'BlobTrigger',
    'QueueTrigger',
    'TimerTrigger'
];
/**
 * Parses templates contained in the output of 'mvn azure-functions:list'.
 * This basically converts the 'raw' templates in the externally defined JSON format to a common and understood format (IFunctionTemplate) used by this extension
 */
function parseJavaTemplates(allTemplates, functionAppPath, telemetryProperties) {
    return __awaiter(this, void 0, void 0, function* () {
        let embeddedTemplates = { templates: [] };
        let embeddedConfig = {};
        let embeddedResources = {};
        try {
            // Try to get the templates information by calling 'mvn azure-functions:list'.
            const commandResult = yield mavenUtils_1.mavenUtils.executeMvnCommand(telemetryProperties, undefined, functionAppPath, 'azure-functions:list');
            const regExp = />> templates begin <<([\S\s]+)^.+INFO.+ >> templates end <<$[\S\s]+>> bindings begin <<([\S\s]+)^.+INFO.+ >> bindings end <<$[\S\s]+>> resources begin <<([\S\s]+)^.+INFO.+ >> resources end <<$/gm;
            const regExpResult = regExp.exec(commandResult);
            if (regExpResult && regExpResult.length > 3) {
                embeddedTemplates = JSON.parse(regExpResult[1]);
                embeddedConfig = JSON.parse(regExpResult[2]);
                embeddedResources = JSON.parse(regExpResult[3]);
            }
        }
        catch (error) {
            // Swallow the exception if the plugin do not support list templates information.
            if (telemetryProperties) {
                telemetryProperties.parseJavaTemplateErrors = vscode_azureextensionui_1.parseError(error).message;
            }
        }
        const templates = [];
        for (const template of embeddedTemplates.templates) {
            try {
                templates.push(parseScriptTemplates_1.parseScriptTemplate(template, embeddedResources, embeddedConfig));
            }
            catch (error) {
                // Ignore errors so that a single poorly formed template does not affect other templates
            }
        }
        if (templates.length > 0) {
            return templates;
        }
        else {
            // If the templates.length is 0, this means that the user is using an older version of Maven function plugin,
            // which do not have the functionality to provide the template information.
            // For this kind of scenario, we will fallback to leverage the JavaScript templates.
            const javaScriptTemplates = allTemplates.filter((t) => t.language === constants_1.ProjectLanguage.JavaScript);
            return javaScriptTemplates.filter((t) => backupJavaTemplateNames.find((vt) => vt === FunctionTemplates_1.removeLanguageFromId(t.id)));
        }
    });
}
exports.parseJavaTemplates = parseJavaTemplates;
//# sourceMappingURL=parseJavaTemplates.js.map