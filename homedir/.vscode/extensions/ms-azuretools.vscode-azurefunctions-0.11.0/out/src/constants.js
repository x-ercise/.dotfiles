"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWindows = /^win/.test(process.platform);
exports.extensionPrefix = 'azureFunctions';
exports.projectLanguageSetting = 'projectLanguage';
exports.projectRuntimeSetting = 'projectRuntime';
exports.templateFilterSetting = 'templateFilter';
exports.deploySubpathSetting = 'deploySubpath';
exports.templateVersionSetting = 'templateVersion';
exports.preDeployTaskSetting = 'preDeployTask';
var ProjectLanguage;
(function (ProjectLanguage) {
    ProjectLanguage["Bash"] = "Bash";
    ProjectLanguage["Batch"] = "Batch";
    ProjectLanguage["CSharp"] = "C#";
    ProjectLanguage["CSharpScript"] = "C#Script";
    ProjectLanguage["FSharp"] = "F#";
    ProjectLanguage["FSharpScript"] = "F#Script";
    ProjectLanguage["Java"] = "Java";
    ProjectLanguage["JavaScript"] = "JavaScript";
    ProjectLanguage["PHP"] = "PHP";
    ProjectLanguage["PowerShell"] = "PowerShell";
    ProjectLanguage["Python"] = "Python";
    ProjectLanguage["TypeScript"] = "TypeScript";
})(ProjectLanguage = exports.ProjectLanguage || (exports.ProjectLanguage = {}));
var ProjectRuntime;
(function (ProjectRuntime) {
    ProjectRuntime["v1"] = "~1";
    ProjectRuntime["v2"] = "~2";
})(ProjectRuntime = exports.ProjectRuntime || (exports.ProjectRuntime = {}));
var TemplateFilter;
(function (TemplateFilter) {
    TemplateFilter["All"] = "All";
    TemplateFilter["Core"] = "Core";
    TemplateFilter["Verified"] = "Verified";
})(TemplateFilter = exports.TemplateFilter || (exports.TemplateFilter = {}));
var Platform;
(function (Platform) {
    Platform["Windows"] = "win32";
    Platform["MacOS"] = "darwin";
    Platform["Linux"] = "linux";
})(Platform = exports.Platform || (exports.Platform = {}));
exports.hostFileName = 'host.json';
exports.localSettingsFileName = 'local.settings.json';
exports.proxiesFileName = 'proxies.json';
exports.tasksFileName = 'tasks.json';
exports.vscodeFolderName = '.vscode';
exports.gitignoreFileName = '.gitignore';
var PackageManager;
(function (PackageManager) {
    PackageManager[PackageManager["npm"] = 0] = "npm";
    PackageManager[PackageManager["brew"] = 1] = "brew";
})(PackageManager = exports.PackageManager || (exports.PackageManager = {}));
exports.funcPackageName = 'azure-functions-core-tools';
var ScmType;
(function (ScmType) {
    ScmType["None"] = "None";
    ScmType["LocalGit"] = "LocalGit";
    ScmType["GitHub"] = "GitHub";
})(ScmType = exports.ScmType || (exports.ScmType = {}));
exports.publishTaskId = 'publish';
exports.installExtensionsId = 'installExtensions';
exports.funcPackId = 'funcPack';
//# sourceMappingURL=constants.js.map