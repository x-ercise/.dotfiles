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
const ProjectSettings_1 = require("../../ProjectSettings");
const fs_1 = require("../../utils/fs");
const fsUtil = require("../../utils/fs");
const workspaceUtil = require("../../utils/workspace");
const createNewProject_1 = require("./createNewProject");
const detectProjectLanguage_1 = require("./detectProjectLanguage");
function initProjectForVSCode(actionContext, ui, outputChannel, functionAppPath, language, runtime, projectCreator) {
    return __awaiter(this, void 0, void 0, function* () {
        const telemetryProperties = actionContext.properties;
        if (functionAppPath === undefined) {
            functionAppPath = yield workspaceUtil.selectWorkspaceFolder(ui, localize_1.localize('azFunc.selectFunctionAppFolderNew', 'Select the folder to initialize for use with VS Code'));
        }
        yield fse.ensureDir(functionAppPath);
        if (!language) {
            // tslint:disable-next-line:strict-boolean-expressions
            language = ProjectSettings_1.getGlobalFuncExtensionSetting(constants_1.projectLanguageSetting) || (yield detectProjectLanguage_1.detectProjectLanguage(functionAppPath)) || (yield ProjectSettings_1.promptForProjectLanguage(ui));
        }
        telemetryProperties.projectLanguage = language;
        outputChannel.appendLine(localize_1.localize('usingLanguage', 'Using "{0}" as the project language...', language));
        if (!projectCreator) {
            projectCreator = createNewProject_1.getProjectCreator(language, functionAppPath, actionContext);
        }
        // tslint:disable-next-line:strict-boolean-expressions
        runtime = runtime || ProjectSettings_1.getGlobalFuncExtensionSetting(constants_1.projectRuntimeSetting) || (yield projectCreator.getRuntime());
        outputChannel.appendLine(localize_1.localize('usingRuntime', 'Using "{0}" as the project runtime...', runtime));
        telemetryProperties.projectRuntime = runtime;
        // tslint:disable-next-line:strict-boolean-expressions
        const templateFilter = ProjectSettings_1.getGlobalFuncExtensionSetting(constants_1.templateFilterSetting) || projectCreator.templateFilter;
        outputChannel.appendLine(localize_1.localize('usingTemplateFilter', 'Using "{0}" as the project templateFilter...', templateFilter));
        telemetryProperties.templateFilter = templateFilter;
        const vscodePath = path.join(functionAppPath, '.vscode');
        yield fse.ensureDir(vscodePath);
        outputChannel.appendLine(localize_1.localize('writingDebugConfig', 'Writing project debug configuration...'));
        yield writeDebugConfiguration(projectCreator, vscodePath, ui, runtime);
        outputChannel.appendLine(localize_1.localize('writingSettings', 'Writing project settings...'));
        yield writeVSCodeSettings(projectCreator, vscodePath, runtime, language, templateFilter, ui);
        outputChannel.appendLine(localize_1.localize('writingRecommendations', 'Writing extension recommendations...'));
        yield writeExtensionRecommendations(projectCreator, vscodePath, ui);
        // Remove '.vscode' from gitignore if applicable
        const gitignorePath = path.join(functionAppPath, constants_1.gitignoreFileName);
        if (yield fse.pathExists(gitignorePath)) {
            outputChannel.appendLine(localize_1.localize('gitignoreVSCode', 'Verifying ".vscode" is not listed in gitignore...'));
            let gitignoreContents = (yield fse.readFile(gitignorePath)).toString();
            gitignoreContents = gitignoreContents.replace(/^\.vscode\s*$/gm, '');
            yield fse.writeFile(gitignorePath, gitignoreContents);
        }
        outputChannel.appendLine(localize_1.localize('finishedInitializing', 'Finished initializing for use with VS Code.'));
        return projectCreator;
    });
}
exports.initProjectForVSCode = initProjectForVSCode;
function writeDebugConfiguration(projectCreator, vscodePath, ui, runtime) {
    return __awaiter(this, void 0, void 0, function* () {
        const tasksJsonPath = path.join(vscodePath, 'tasks.json');
        if (yield fs_1.confirmOverwriteFile(tasksJsonPath, ui)) {
            yield fsUtil.writeFormattedJson(tasksJsonPath, yield projectCreator.getTasksJson(runtime));
        }
        const launchJson = projectCreator.getLaunchJson();
        if (launchJson) {
            const launchJsonPath = path.join(vscodePath, 'launch.json');
            if (yield fs_1.confirmOverwriteFile(launchJsonPath, ui)) {
                yield fsUtil.writeFormattedJson(launchJsonPath, launchJson);
            }
        }
    });
}
function writeVSCodeSettings(projectCreator, vscodePath, runtime, language, templateFilter, ui) {
    return __awaiter(this, void 0, void 0, function* () {
        const settingsJsonPath = path.join(vscodePath, 'settings.json');
        yield fsUtil.confirmEditJsonFile(settingsJsonPath, (data) => {
            data[`${constants_1.extensionPrefix}.${constants_1.projectRuntimeSetting}`] = runtime;
            data[`${constants_1.extensionPrefix}.${constants_1.projectLanguageSetting}`] = language;
            data[`${constants_1.extensionPrefix}.${constants_1.templateFilterSetting}`] = templateFilter;
            if (projectCreator.deploySubpath) {
                data[`${constants_1.extensionPrefix}.${constants_1.deploySubpathSetting}`] = projectCreator.deploySubpath;
            }
            if (projectCreator.preDeployTask) {
                data[`${constants_1.extensionPrefix}.${constants_1.preDeployTaskSetting}`] = projectCreator.preDeployTask;
            }
            return data;
        }, ui);
    });
}
function writeExtensionRecommendations(projectCreator, vscodePath, ui) {
    return __awaiter(this, void 0, void 0, function* () {
        const extensionsJsonPath = path.join(vscodePath, 'extensions.json');
        yield fsUtil.confirmEditJsonFile(extensionsJsonPath, (data) => {
            let recommendations = projectCreator.getRecommendedExtensions();
            if (data.recommendations) {
                recommendations = recommendations.concat(data.recommendations);
            }
            // de-dupe array
            data.recommendations = recommendations.filter((rec, index) => recommendations.indexOf(rec) === index);
            return data;
        }, ui);
    });
}
//# sourceMappingURL=initProjectForVSCode.js.map