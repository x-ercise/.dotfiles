"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.deploymentFileName = '.deployment';
exports.deploymentFile = `[config]
SCM_DO_BUILD_DURING_DEPLOYMENT=true`;
exports.none = 'None';
exports.extensionPrefix = 'appService';
var runtimes;
(function (runtimes) {
    runtimes["node"] = "node";
    runtimes["php"] = "php";
    runtimes["dotnetcore"] = "dotnetcore";
    runtimes["ruby"] = "ruby";
    runtimes["tomcat"] = "tomcat";
    runtimes["javase"] = "java|8-jre8";
})(runtimes = exports.runtimes || (exports.runtimes = {}));
function getIgnoredFoldersForDeployment(runtime) {
    switch (runtime) {
        case runtimes.node:
            return ['node_modules{,/**}'];
        default:
            return [];
    }
}
exports.getIgnoredFoldersForDeployment = getIgnoredFoldersForDeployment;
var configurationSettings;
(function (configurationSettings) {
    configurationSettings["zipIgnorePattern"] = "zipIgnorePattern";
    configurationSettings["showBuildDuringDeployPrompt"] = "showBuildDuringDeployPrompt";
    configurationSettings["deploySubpath"] = "deploySubpath";
    configurationSettings["advancedCreation"] = "advancedCreation";
    configurationSettings["defaultWebAppToDeploy"] = "defaultWebAppToDeploy";
})(configurationSettings = exports.configurationSettings || (exports.configurationSettings = {}));
var ScmType;
(function (ScmType) {
    ScmType["None"] = "None";
    ScmType["LocalGit"] = "LocalGit";
    ScmType["GitHub"] = "GitHub";
})(ScmType = exports.ScmType || (exports.ScmType = {}));
//# sourceMappingURL=constants.js.map