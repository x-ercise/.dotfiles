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
const semver_1 = require("semver");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const constants_1 = require("../../constants");
const tryGetLocalRuntimeVersion_1 = require("../../funcCoreTools/tryGetLocalRuntimeVersion");
const localize_1 = require("../../localize");
const ProjectSettings_1 = require("../../ProjectSettings");
const executeDotnetTemplateCommand_1 = require("../../templates/executeDotnetTemplateCommand");
const cpUtils_1 = require("../../utils/cpUtils");
const dotnetUtils_1 = require("../../utils/dotnetUtils");
const IProjectCreator_1 = require("./IProjectCreator");
class CSharpProjectCreator extends IProjectCreator_1.ProjectCreatorBase {
    constructor() {
        super(...arguments);
        this.templateFilter = constants_1.TemplateFilter.Verified;
        this.preDeployTask = constants_1.publishTaskId;
        this._hasDetectedRuntime = false;
    }
    addNonVSCodeFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            yield dotnetUtils_1.dotnetUtils.validateDotnetInstalled();
            const projectName = path.basename(this.functionAppPath);
            const csProjName = `${projectName}.csproj`;
            yield this.confirmOverwriteExisting(this.functionAppPath, csProjName);
            // tslint:disable-next-line:strict-boolean-expressions
            this._runtime = (yield tryGetLocalRuntimeVersion_1.tryGetLocalRuntimeVersion()) || (yield ProjectSettings_1.promptForProjectRuntime());
            const identity = `Microsoft.AzureFunctions.ProjectTemplate.CSharp.${this._runtime === constants_1.ProjectRuntime.v1 ? '1' : '2'}.x`;
            const functionsVersion = this._runtime === constants_1.ProjectRuntime.v1 ? 'v1' : 'v2';
            yield executeDotnetTemplateCommand_1.executeDotnetTemplateCommand(this._runtime, this.functionAppPath, 'create', '--identity', identity, '--arg:name', cpUtils_1.cpUtils.wrapArgInQuotes(projectName), '--arg:AzureFunctionsVersion', functionsVersion);
            if (!this._hasDetectedRuntime) {
                yield this.detectRuntime();
            }
        });
    }
    getRuntime() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._hasDetectedRuntime) {
                yield this.detectRuntime();
            }
            return this._runtime;
        });
    }
    getTasksJson() {
        return {
            version: '2.0.0',
            tasks: [
                {
                    label: 'clean',
                    command: 'dotnet clean',
                    type: 'shell',
                    presentation: {
                        reveal: 'always'
                    },
                    problemMatcher: '$msCompile'
                },
                {
                    label: 'build',
                    command: 'dotnet build',
                    type: 'shell',
                    dependsOn: 'clean',
                    group: {
                        kind: 'build',
                        isDefault: true
                    },
                    presentation: {
                        reveal: 'always'
                    },
                    problemMatcher: '$msCompile'
                },
                {
                    label: 'clean release',
                    command: 'dotnet clean --configuration Release',
                    type: 'shell',
                    presentation: {
                        reveal: 'always'
                    },
                    problemMatcher: '$msCompile'
                },
                {
                    label: constants_1.publishTaskId,
                    identifier: constants_1.publishTaskId,
                    command: 'dotnet publish --configuration Release',
                    type: 'shell',
                    dependsOn: 'clean release',
                    presentation: {
                        reveal: 'always'
                    },
                    problemMatcher: '$msCompile'
                },
                {
                    label: localize_1.localize('azFunc.runFuncHost', 'Run Functions Host'),
                    identifier: IProjectCreator_1.funcHostTaskId,
                    type: 'shell',
                    dependsOn: 'build',
                    options: {
                        cwd: `\${workspaceFolder}/${this._debugSubpath}`
                    },
                    command: 'func host start',
                    isBackground: true,
                    presentation: {
                        reveal: 'always'
                    },
                    problemMatcher: IProjectCreator_1.funcWatchProblemMatcher
                }
            ]
        };
    }
    getLaunchJson() {
        return {
            version: '0.2.0',
            configurations: [
                {
                    name: localize_1.localize('azFunc.attachToNetCoreFunc', "Attach to C# Functions"),
                    type: this._runtime === constants_1.ProjectRuntime.v2 ? 'coreclr' : 'clr',
                    request: 'attach',
                    processId: '\${command:azureFunctions.pickProcess}'
                }
            ]
        };
    }
    getRecommendedExtensions() {
        return super.getRecommendedExtensions().concat(['ms-vscode.csharp']);
    }
    /**
     * Detects the runtime based on the targetFramework from the csproj file
     * Also performs a few validations and sets a few properties based on that targetFramework
     */
    detectRuntime() {
        return __awaiter(this, void 0, void 0, function* () {
            const csProjName = yield tryGetCsprojFile(this.functionAppPath);
            if (!csProjName) {
                throw new Error(localize_1.localize('csprojNotFound', 'Expected to find a single "csproj" file in folder "{0}", but found zero or multiple instead.', path.basename(this.functionAppPath)));
            }
            const csprojPath = path.join(this.functionAppPath, csProjName);
            const csprojContents = (yield fse.readFile(csprojPath)).toString();
            yield this.validateFuncSdkVersion(csprojPath, csprojContents);
            const matches = csprojContents.match(/<TargetFramework>(.*)<\/TargetFramework>/);
            if (matches === null || matches.length < 1) {
                throw new Error(localize_1.localize('unrecognizedTargetFramework', 'Unrecognized target framework in project file "{0}".', csProjName));
            }
            else {
                const targetFramework = matches[1];
                this.telemetryProperties.cSharpTargetFramework = targetFramework;
                if (targetFramework.startsWith('netstandard')) {
                    this._runtime = constants_1.ProjectRuntime.v2;
                }
                else {
                    this._runtime = constants_1.ProjectRuntime.v1;
                    const settingKey = 'show64BitWarning';
                    if (ProjectSettings_1.getFuncExtensionSetting(settingKey)) {
                        const message = localize_1.localize('64BitWarning', 'In order to debug .NET Framework functions in VS Code, you must install a 64-bit version of the Azure Functions Core Tools.');
                        try {
                            const result = yield this.ui.showWarningMessage(message, vscode_azureextensionui_1.DialogResponses.learnMore, vscode_azureextensionui_1.DialogResponses.dontWarnAgain);
                            if (result === vscode_azureextensionui_1.DialogResponses.learnMore) {
                                yield opn('https://aka.ms/azFunc64bit');
                            }
                            else if (result === vscode_azureextensionui_1.DialogResponses.dontWarnAgain) {
                                yield ProjectSettings_1.updateGlobalSetting(settingKey, false);
                            }
                        }
                        catch (err) {
                            // swallow cancellations (aka if they clicked the 'x' button to dismiss the warning) and proceed to create project
                            if (!vscode_azureextensionui_1.parseError(err).isUserCancelledError) {
                                throw err;
                            }
                        }
                    }
                }
                this.deploySubpath = `bin/Release/${targetFramework}/publish`;
                this._debugSubpath = `bin/Debug/${targetFramework}`;
            }
            this._hasDetectedRuntime = true;
        });
    }
    /**
     * Validates the project has the minimum Functions SDK version that works on all OS's
     * See this bug for more info: https://github.com/Microsoft/vscode-azurefunctions/issues/164
     */
    validateFuncSdkVersion(csprojPath, csprojContents) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!constants_1.isWindows) { // No need to validate on Windows - it should work with previous versions
                try {
                    const minVersion = '1.0.8';
                    const lineMatches = /^.*Microsoft\.NET\.Sdk\.Functions.*$/gm.exec(csprojContents);
                    if (lineMatches !== null && lineMatches.length > 0) {
                        const line = lineMatches[0];
                        const versionMatches = /Version=(?:"([^"]+)"|'([^']+)')/g.exec(line);
                        if (versionMatches !== null && versionMatches.length > 2) {
                            const version = new semver_1.SemVer(versionMatches[1] || versionMatches[2]);
                            this.telemetryProperties.cSharpFuncSdkVersion = version.raw;
                            if (version.compare(minVersion) < 0) {
                                const newContents = csprojContents.replace(line, line.replace(version.raw, minVersion));
                                yield fse.writeFile(csprojPath, newContents);
                            }
                        }
                    }
                }
                catch (err) {
                    this.telemetryProperties.cSharpFuncSdkError = vscode_azureextensionui_1.parseError(err).message;
                    // ignore errors and assume the version of the templates installed on the user's machine works for them
                }
            }
        });
    }
    confirmOverwriteExisting(functionAppPath, csProjName) {
        return __awaiter(this, void 0, void 0, function* () {
            const filesToCheck = [csProjName, constants_1.gitignoreFileName, constants_1.localSettingsFileName, constants_1.hostFileName];
            const existingFiles = [];
            for (const fileName of filesToCheck) {
                if (yield fse.pathExists(path.join(functionAppPath, fileName))) {
                    existingFiles.push(fileName);
                }
            }
            if (existingFiles.length > 0) {
                yield this.ui.showWarningMessage(localize_1.localize('overwriteExistingFiles', 'Overwrite existing files?: {0}', existingFiles.join(', ')), { modal: true }, vscode_azureextensionui_1.DialogResponses.yes, vscode_azureextensionui_1.DialogResponses.cancel);
                return true;
            }
            else {
                return false;
            }
        });
    }
}
exports.CSharpProjectCreator = CSharpProjectCreator;
/**
 * If a single csproj file is found at the root of this folder, returns the path to that file. Otherwise returns undefined
 * NOTE: 'extensions.csproj' is excluded as it has special meaning for the func cli
 */
function tryGetCsprojFile(functionAppPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const files = yield fse.readdir(functionAppPath);
        const projectFiles = files.filter((f) => /\.csproj$/i.test(f) && !/extensions\.csproj$/i.test(f));
        return projectFiles.length === 1 ? projectFiles[0] : undefined;
    });
}
exports.tryGetCsprojFile = tryGetCsprojFile;
//# sourceMappingURL=CSharpProjectCreator.js.map