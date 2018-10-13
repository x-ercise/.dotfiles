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
const constants_1 = require("../../constants");
const extensionVariables_1 = require("../../extensionVariables");
const tryGetLocalRuntimeVersion_1 = require("../../funcCoreTools/tryGetLocalRuntimeVersion");
const localize_1 = require("../../localize");
const ProjectSettings_1 = require("../../ProjectSettings");
const fsUtil = require("../../utils/fs");
const initProjectForVSCode_1 = require("./initProjectForVSCode");
const IProjectCreator_1 = require("./IProjectCreator");
const JavaScriptProjectCreator_1 = require("./JavaScriptProjectCreator");
const PythonProjectCreator_1 = require("./PythonProjectCreator");
function validateFunctionProjects(actionContext, ui, outputChannel, folders) {
    return __awaiter(this, void 0, void 0, function* () {
        actionContext.suppressTelemetry = true;
        if (folders) {
            for (const folder of folders) {
                const folderPath = folder.uri.fsPath;
                if (yield isFunctionProject(folderPath)) {
                    actionContext.suppressTelemetry = false;
                    if (isInitializedProject(folderPath)) {
                        actionContext.properties.isInitialized = 'true';
                        actionContext.suppressErrorDisplay = true; // Swallow errors when verifying debug config. No point in showing an error if we can't understand the project anyways
                        const projectLanguage = ProjectSettings_1.getFuncExtensionSetting(constants_1.projectLanguageSetting, folderPath);
                        actionContext.properties.projectLanguage = String(projectLanguage);
                        yield verifyDebugConfigIsValid(projectLanguage, folderPath, actionContext);
                        yield verifyPythonVenv(projectLanguage, folderPath, actionContext);
                    }
                    else {
                        actionContext.properties.isInitialized = 'false';
                        if (yield promptToInitializeProject(ui, folderPath)) {
                            yield vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: localize_1.localize('creating', 'Initializing project...') }, () => __awaiter(this, void 0, void 0, function* () {
                                yield initProjectForVSCode_1.initProjectForVSCode(actionContext, ui, outputChannel, folderPath);
                            }));
                            // don't wait
                            vscode.window.showInformationMessage(localize_1.localize('finishedInit', 'Finished initializing project.'));
                        }
                    }
                }
            }
        }
    });
}
exports.validateFunctionProjects = validateFunctionProjects;
function promptToInitializeProject(ui, folderPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const settingKey = 'showProjectWarning';
        if (ProjectSettings_1.getFuncExtensionSetting(settingKey)) {
            const message = localize_1.localize('uninitializedWarning', 'Detected an Azure Functions Project in folder "{0}" that may have been created outside of VS Code. Initialize for optimal use with VS Code?', path.basename(folderPath));
            const result = yield ui.showWarningMessage(message, vscode_azureextensionui_1.DialogResponses.yes, vscode_azureextensionui_1.DialogResponses.dontWarnAgain, vscode_azureextensionui_1.DialogResponses.learnMore);
            if (result === vscode_azureextensionui_1.DialogResponses.dontWarnAgain) {
                yield ProjectSettings_1.updateGlobalSetting(settingKey, false);
            }
            else if (result === vscode_azureextensionui_1.DialogResponses.learnMore) {
                yield opn('https://aka.ms/azFuncProject');
                return yield promptToInitializeProject(ui, folderPath);
            }
            else {
                return true;
            }
        }
        return false;
    });
}
function isFunctionProject(folderPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const gitignorePath = path.join(folderPath, constants_1.gitignoreFileName);
        let gitignoreContents = '';
        if (yield fse.pathExists(gitignorePath)) {
            gitignoreContents = (yield fse.readFile(gitignorePath)).toString();
        }
        return (yield fse.pathExists(path.join(folderPath, constants_1.hostFileName))) && ((yield fse.pathExists(path.join(folderPath, constants_1.localSettingsFileName))) || gitignoreContents.includes(constants_1.localSettingsFileName));
    });
}
exports.isFunctionProject = isFunctionProject;
function isInitializedProject(folderPath) {
    const language = ProjectSettings_1.getFuncExtensionSetting(constants_1.projectLanguageSetting, folderPath);
    const runtime = ProjectSettings_1.getFuncExtensionSetting(constants_1.projectRuntimeSetting, folderPath);
    return !!language && !!runtime;
}
/**
 * JavaScript debugging in the func cli had breaking changes in v2.0.1-beta.30. This verifies users are up-to-date with the latest working debug config.
 * See https://aka.ms/AA1vrxa for more info
 */
function verifyDebugConfigIsValid(projectLanguage, folderPath, actionContext) {
    return __awaiter(this, void 0, void 0, function* () {
        if (projectLanguage === constants_1.ProjectLanguage.JavaScript) {
            const localProjectRuntime = yield tryGetLocalRuntimeVersion_1.tryGetLocalRuntimeVersion();
            if (localProjectRuntime === constants_1.ProjectRuntime.v2) {
                const tasksJsonPath = path.join(folderPath, constants_1.vscodeFolderName, constants_1.tasksFileName);
                const rawTasksData = (yield fse.readFile(tasksJsonPath)).toString();
                if (!rawTasksData.includes(JavaScriptProjectCreator_1.funcNodeDebugEnvVar)) {
                    const tasksContent = JSON.parse(rawTasksData);
                    const funcTask = tasksContent.tasks.find((t) => t.identifier === IProjectCreator_1.funcHostTaskId);
                    if (funcTask) {
                        actionContext.properties.debugConfigValid = 'false';
                        if (yield promptToUpdateDebugConfiguration(folderPath)) {
                            // tslint:disable-next-line:strict-boolean-expressions
                            funcTask.options = funcTask.options || {};
                            // tslint:disable-next-line:strict-boolean-expressions
                            funcTask.options.env = funcTask.options.env || {};
                            funcTask.options.env[JavaScriptProjectCreator_1.funcNodeDebugEnvVar] = JavaScriptProjectCreator_1.funcNodeDebugArgs;
                            yield fsUtil.writeFormattedJson(tasksJsonPath, tasksContent);
                            actionContext.properties.updatedDebugConfig = 'true';
                            const viewFile = { title: 'View file' };
                            const result = yield vscode.window.showInformationMessage(localize_1.localize('tasksUpdated', 'Your "tasks.json" file has been updated.'), viewFile);
                            if (result === viewFile) {
                                yield vscode.window.showTextDocument(yield vscode.workspace.openTextDocument(vscode.Uri.file(tasksJsonPath)));
                            }
                        }
                    }
                }
            }
        }
    });
}
function promptToUpdateDebugConfiguration(fsPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const settingKey = 'showDebugConfigWarning';
        if (ProjectSettings_1.getFuncExtensionSetting(settingKey)) {
            const updateConfig = { title: localize_1.localize('updateTasks', 'Update tasks.json') };
            const message = localize_1.localize('uninitializedWarning', 'Your debug configuration is out of date and may not work with the latest version of the Azure Functions Core Tools.');
            let result;
            do {
                result = yield extensionVariables_1.ext.ui.showWarningMessage(message, updateConfig, vscode_azureextensionui_1.DialogResponses.dontWarnAgain, vscode_azureextensionui_1.DialogResponses.learnMore);
                if (result === vscode_azureextensionui_1.DialogResponses.dontWarnAgain) {
                    yield ProjectSettings_1.updateWorkspaceSetting(settingKey, false, fsPath);
                }
                else if (result === vscode_azureextensionui_1.DialogResponses.learnMore) {
                    // don't wait to re-show dialog
                    // tslint:disable-next-line:no-floating-promises
                    opn('https://aka.ms/AA1vrxa');
                }
                else {
                    return true;
                }
            } while (result === vscode_azureextensionui_1.DialogResponses.learnMore);
        }
        return false;
    });
}
function verifyPythonVenv(projectLanguage, folderPath, actionContext) {
    return __awaiter(this, void 0, void 0, function* () {
        if (projectLanguage === constants_1.ProjectLanguage.Python) {
            if (!(yield fse.pathExists(path.join(folderPath, PythonProjectCreator_1.funcEnvName)))) {
                actionContext.properties.pythonVenvExists = 'false';
                const settingKey = 'showPythonVenvWarning';
                if (ProjectSettings_1.getFuncExtensionSetting(settingKey)) {
                    const createVenv = { title: localize_1.localize('createVenv', 'Create virtual environment') };
                    const message = localize_1.localize('uninitializedWarning', 'Failed to find Python virtual environment, which is required to debug and deploy your Azure Functions project.');
                    const result = yield extensionVariables_1.ext.ui.showWarningMessage(message, createVenv, vscode_azureextensionui_1.DialogResponses.dontWarnAgain);
                    if (result === createVenv) {
                        yield vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: localize_1.localize('creatingVenv', 'Creating virtual environment...') }, () => __awaiter(this, void 0, void 0, function* () {
                            // create venv
                            yield PythonProjectCreator_1.createVirtualEnviornment(folderPath);
                            yield PythonProjectCreator_1.makeVenvDebuggable(folderPath);
                            // install venv requirements
                            const requirementsFileName = 'requirements.txt';
                            if (yield fse.pathExists(path.join(folderPath, requirementsFileName))) {
                                yield PythonProjectCreator_1.runPythonCommandInVenv(folderPath, `pip install -r ${requirementsFileName}`);
                            }
                        }));
                        actionContext.properties.createdPythonVenv = 'true';
                        // don't wait
                        vscode.window.showInformationMessage(localize_1.localize('finishedCreatingVenv', 'Finished creating virtual environment.'));
                    }
                    else if (result === vscode_azureextensionui_1.DialogResponses.dontWarnAgain) {
                        yield ProjectSettings_1.updateGlobalSetting(settingKey, false);
                    }
                }
            }
        }
    });
}
//# sourceMappingURL=validateFunctionProjects.js.map