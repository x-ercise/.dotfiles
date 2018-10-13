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
const opn = require("opn");
const path = require("path");
const vscode_1 = require("vscode");
const vscode_azureappservice_1 = require("vscode-azureappservice");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const constants = require("../constants");
const extensionVariables_1 = require("../extensionVariables");
class SiteTreeItem {
    constructor(client) {
        this.client = client;
        this._state = client.initialState;
    }
    get label() {
        // tslint:disable-next-line:no-non-null-assertion
        return this.client.isSlot ? this.client.slotName : this.client.siteName;
    }
    get description() {
        return this._state && this._state.toLowerCase() !== 'running' ? this._state : undefined;
    }
    get logStreamLabel() {
        return `${this.client.fullName} - Log Stream`;
    }
    refreshLabel() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this._state = yield this.client.getState();
            }
            catch (_a) {
                this._state = 'Unknown';
            }
        });
    }
    hasMoreChildren() {
        return false;
    }
    get id() {
        return this.client.id;
    }
    browse() {
        // tslint:disable-next-line:no-unsafe-any
        opn(this.client.defaultHostUrl);
    }
    deleteTreeItem(_node) {
        return __awaiter(this, void 0, void 0, function* () {
            yield vscode_azureappservice_1.deleteSite(this.client);
        });
    }
    isHttpLogsEnabled() {
        return __awaiter(this, void 0, void 0, function* () {
            const logsConfig = yield this.client.getLogsConfig();
            return !!(logsConfig.httpLogs && logsConfig.httpLogs.fileSystem && logsConfig.httpLogs.fileSystem.enabled);
        });
    }
    enableHttpLogs() {
        return __awaiter(this, void 0, void 0, function* () {
            const logsConfig = {
                httpLogs: {
                    fileSystem: {
                        enabled: true,
                        retentionInDays: 7,
                        retentionInMb: 35
                    }
                }
            };
            yield this.client.updateLogsConfig(logsConfig);
        });
    }
    enableScmDoBuildDuringDeploy(fsPath, runtime, telemetryProperties) {
        return __awaiter(this, void 0, void 0, function* () {
            const yesButton = { title: 'Yes' };
            const dontShowAgainButton = { title: "No, and don't show again" };
            const learnMoreButton = { title: 'Learn More' };
            const zipIgnoreFolders = constants.getIgnoredFoldersForDeployment(runtime);
            const buildDuringDeploy = `Would you like to update your workspace configuration to run npm install on the target server? This should improve deployment performance.`;
            let input = learnMoreButton;
            while (input === learnMoreButton) {
                input = yield vscode_1.window.showInformationMessage(buildDuringDeploy, yesButton, dontShowAgainButton, learnMoreButton);
                if (input === learnMoreButton) {
                    // tslint:disable-next-line:no-unsafe-any
                    opn('https://aka.ms/Kwwkbd');
                }
            }
            if (input === yesButton) {
                let oldSettings = vscode_1.workspace.getConfiguration(constants.extensionPrefix, vscode_1.Uri.file(fsPath)).get(constants.configurationSettings.zipIgnorePattern);
                if (!oldSettings) {
                    oldSettings = [];
                }
                else if (typeof oldSettings === "string") {
                    oldSettings = [oldSettings];
                    // settings have to be an array to concat the proper zipIgnoreFolders
                }
                vscode_1.workspace.getConfiguration(constants.extensionPrefix, vscode_1.Uri.file(fsPath)).update(constants.configurationSettings.zipIgnorePattern, oldSettings.concat(zipIgnoreFolders));
                yield fse.writeFile(path.join(fsPath, constants.deploymentFileName), constants.deploymentFile);
                telemetryProperties.enableScmInput = "Yes";
            }
            else {
                vscode_1.workspace.getConfiguration(constants.extensionPrefix, vscode_1.Uri.file(fsPath)).update(constants.configurationSettings.showBuildDuringDeployPrompt, false);
                telemetryProperties.enableScmInput = "No, and don't show again";
            }
            if (!telemetryProperties.enableScmInput) {
                telemetryProperties.enableScmInput = "Canceled";
            }
        });
    }
    promptToSaveDeployDefaults(node, workspacePath, deployPath, telemetryProperties) {
        return __awaiter(this, void 0, void 0, function* () {
            const saveDeploymentConfig = `Always deploy the workspace "${path.basename(workspacePath)}" to "${node.treeItem.client.fullName}"?`;
            const dontShowAgain = { title: "Don't show again" };
            const workspaceConfiguration = vscode_1.workspace.getConfiguration(constants.extensionPrefix, vscode_1.Uri.file(deployPath));
            const result = yield extensionVariables_1.ext.ui.showWarningMessage(saveDeploymentConfig, vscode_azureextensionui_1.DialogResponses.yes, dontShowAgain, vscode_azureextensionui_1.DialogResponses.skipForNow);
            if (result === vscode_azureextensionui_1.DialogResponses.yes) {
                workspaceConfiguration.update(constants.configurationSettings.defaultWebAppToDeploy, node.id);
                workspaceConfiguration.update(constants.configurationSettings.deploySubpath, path.relative(workspacePath, deployPath)); // '' is a falsey value
                telemetryProperties.promptToSaveDeployConfigs = 'Yes';
            }
            else if (result === dontShowAgain) {
                workspaceConfiguration.update(constants.configurationSettings.defaultWebAppToDeploy, constants.none);
                telemetryProperties.promptToSaveDeployConfigs = "Don't show again";
            }
            else {
                telemetryProperties.promptToSaveDeployConfigs = 'Skip for now';
            }
        });
    }
}
exports.SiteTreeItem = SiteTreeItem;
//# sourceMappingURL=SiteTreeItem.js.map