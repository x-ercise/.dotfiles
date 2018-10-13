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
const crypto_1 = require("crypto");
const fs_extra_1 = require("fs-extra");
const path = require("path");
const path_1 = require("path");
const vscode = require("vscode");
const appservice = require("vscode-azureappservice");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const constants = require("../constants");
const WebAppTreeItem_1 = require("../explorer/WebAppTreeItem");
const extensionVariables_1 = require("../extensionVariables");
const util = require("../util");
const javaUtil = require("../utils/javaUtils");
const pathUtils_1 = require("../utils/pathUtils");
const validateWebSite_1 = require("../validateWebSite");
const startStreamingLogs_1 = require("./startStreamingLogs");
// tslint:disable-next-line:max-func-body-length cyclomatic-complexity
function deploy(context, confirmDeployment, target) {
    return __awaiter(this, void 0, void 0, function* () {
        let node;
        const newNodes = [];
        let fsPath;
        let currentWorkspace;
        let defaultWebAppToDeploy;
        let workspaceConfig;
        context.properties.deployedWithConfigs = 'false';
        if (target instanceof vscode.Uri) {
            fsPath = target.fsPath;
            context.properties.deploymentEntryPoint = 'fileExplorerContextMenu';
        }
        else {
            context.properties.deploymentEntryPoint = target ? 'webAppContextMenu' : 'deployButton';
            node = target;
        }
        // only use the defaultWebAppToDeploy is there is only one workspace opened
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length === 1) {
            currentWorkspace = vscode.workspace.workspaceFolders[0];
            workspaceConfig = vscode.workspace.getConfiguration(constants.extensionPrefix, currentWorkspace.uri);
            defaultWebAppToDeploy = workspaceConfig.get(constants.configurationSettings.defaultWebAppToDeploy);
            if (defaultWebAppToDeploy && defaultWebAppToDeploy !== constants.none) {
                const defaultSubpath = workspaceConfig.get(constants.configurationSettings.deploySubpath);
                const defaultDeployPath = defaultSubpath ? path_1.join(currentWorkspace.uri.fsPath, defaultSubpath) : currentWorkspace.uri.fsPath;
                const defaultPathExists = yield fs_extra_1.pathExists(defaultDeployPath);
                const defaultNode = yield extensionVariables_1.ext.tree.findNode(defaultWebAppToDeploy); // resolves to undefined if app can't be found
                if (defaultPathExists && (!fsPath || pathUtils_1.isPathEqual(fsPath, defaultDeployPath)) &&
                    defaultNode && (!node || node.id === defaultNode.id)) {
                    fsPath = defaultDeployPath;
                    node = defaultNode;
                    context.properties.deployedWithConfigs = 'true';
                }
                else {
                    // if defaultPath or defaultNode cannot be found or there was a mismatch, delete old settings and prompt to save next deployment
                    workspaceConfig.update(constants.configurationSettings.defaultWebAppToDeploy, undefined);
                }
            }
        }
        if (!node) {
            const onNodeCreatedFromQuickPickDisposable = extensionVariables_1.ext.tree.onNodeCreate((newNode) => {
                // event is fired from azure-extensionui if node was created during deployment
                newNodes.push(newNode);
            });
            try {
                node = (yield extensionVariables_1.ext.tree.showNodePicker(WebAppTreeItem_1.WebAppTreeItem.contextValue));
            }
            catch (err2) {
                if (vscode_azureextensionui_1.parseError(err2).isUserCancelledError) {
                    context.properties.cancelStep = `showNodePicker:${WebAppTreeItem_1.WebAppTreeItem.contextValue}`;
                }
                throw err2;
            }
            finally {
                onNodeCreatedFromQuickPickDisposable.dispose();
            }
        }
        const treeItem = node.treeItem;
        if (newNodes.length > 0) {
            for (const newApp of newNodes) {
                if (newApp.id === node.id) {
                    // if the node selected for deployment is the same newly created nodes, stifle the confirmDeployment dialog
                    confirmDeployment = false;
                    newApp.treeItem.client.getSiteConfig().then((createdAppConfig) => {
                        context.properties.linuxFxVersion = createdAppConfig.linuxFxVersion ? createdAppConfig.linuxFxVersion : 'undefined';
                        context.properties.createdFromDeploy = 'true';
                    }, () => {
                        // ignore
                    });
                }
            }
        }
        const correlationId = getRandomHexString(10);
        context.properties.correlationId = correlationId;
        const siteConfig = yield treeItem.client.getSiteConfig();
        if (!fsPath) {
            if (javaUtil.isJavaRuntime(siteConfig.linuxFxVersion)) {
                fsPath = yield javaUtil.getJavaRuntimeTargetFile(siteConfig.linuxFxVersion, context.properties);
            }
            else {
                fsPath = yield util.showWorkspaceFoldersQuickPick("Select the folder to deploy", context.properties, constants.configurationSettings.deploySubpath);
            }
        }
        workspaceConfig = vscode.workspace.getConfiguration(constants.extensionPrefix, vscode.Uri.file(fsPath));
        if (workspaceConfig.get(constants.configurationSettings.showBuildDuringDeployPrompt)) {
            if (siteConfig.linuxFxVersion && siteConfig.linuxFxVersion.startsWith(constants.runtimes.node) && siteConfig.scmType === 'None' && !(yield fs_extra_1.pathExists(path.join(fsPath, constants.deploymentFileName)))) {
                // check if web app has node runtime, is being zipdeployed, and if there is no .deployment file
                // tslint:disable-next-line:no-unsafe-any
                yield treeItem.enableScmDoBuildDuringDeploy(fsPath, constants.runtimes[siteConfig.linuxFxVersion.substring(0, siteConfig.linuxFxVersion.indexOf('|'))], context.properties);
            }
        }
        if (confirmDeployment && siteConfig.scmType !== constants.ScmType.LocalGit && siteConfig !== constants.ScmType.GitHub) {
            const warning = `Are you sure you want to deploy to "${treeItem.client.fullName}"? This will overwrite any previous deployment and cannot be undone.`;
            context.properties.cancelStep = 'confirmDestructiveDeployment';
            const deployButton = { title: 'Deploy' };
            yield extensionVariables_1.ext.ui.showWarningMessage(warning, { modal: true }, deployButton, vscode_azureextensionui_1.DialogResponses.cancel);
            context.properties.cancelStep = '';
        }
        if (!defaultWebAppToDeploy && currentWorkspace && (pathUtils_1.isPathEqual(currentWorkspace.uri.fsPath, fsPath) || pathUtils_1.isSubpath(currentWorkspace.uri.fsPath, fsPath))) {
            // tslint:disable-next-line:no-floating-promises
            treeItem.promptToSaveDeployDefaults(node, currentWorkspace.uri.fsPath, fsPath, context.properties);
        }
        validateWebSite_1.cancelWebsiteValidation(treeItem);
        yield node.runWithTemporaryDescription("Deploying...", () => __awaiter(this, void 0, void 0, function* () {
            yield appservice.deploy(treeItem.client, fsPath, constants.extensionPrefix, context.properties);
        }));
        const deployComplete = `Deployment to "${treeItem.client.fullName}" completed.`;
        extensionVariables_1.ext.outputChannel.appendLine(deployComplete);
        const viewOutput = { title: 'View Output' };
        const browseWebsite = { title: 'Browse Website' };
        const streamLogs = { title: 'Stream Logs' };
        // Don't wait
        vscode.window.showInformationMessage(deployComplete, browseWebsite, streamLogs, viewOutput).then((result) => __awaiter(this, void 0, void 0, function* () {
            if (result === viewOutput) {
                extensionVariables_1.ext.outputChannel.show();
            }
            else if (result === browseWebsite) {
                treeItem.browse();
            }
            else if (result === streamLogs) {
                yield startStreamingLogs_1.startStreamingLogs(node);
            }
        }));
        // Don't wait
        validateWebSite_1.validateWebSite(correlationId, node.treeItem).then(() => {
            // ignore
        }, () => {
            // ignore
        });
    });
}
exports.deploy = deploy;
function getRandomHexString(length) {
    const buffer = crypto_1.randomBytes(Math.ceil(length / 2));
    return buffer.toString('hex').slice(0, length);
}
//# sourceMappingURL=deploy.js.map