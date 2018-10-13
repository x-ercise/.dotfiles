/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const vscode = require("vscode");
const vscode_azureappservice_1 = require("vscode-azureappservice");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const vscode_extension_telemetry_1 = require("vscode-extension-telemetry");
const deploy_1 = require("./commands/deploy");
const enableFileLogging_1 = require("./commands/enableFileLogging");
const disableRemoteDebug_1 = require("./commands/remoteDebug/disableRemoteDebug");
const startRemoteDebug_1 = require("./commands/remoteDebug/startRemoteDebug");
const startStreamingLogs_1 = require("./commands/startStreamingLogs");
const swapSlots_1 = require("./commands/swapSlots");
const DeploymentSlotsTreeItem_1 = require("./explorer/DeploymentSlotsTreeItem");
const FileEditor_1 = require("./explorer/editors/FileEditor");
const FolderTreeItem_1 = require("./explorer/FolderTreeItem");
const loadedScriptsExplorer_1 = require("./explorer/loadedScriptsExplorer");
const WebAppProvider_1 = require("./explorer/WebAppProvider");
const WebAppTreeItem_1 = require("./explorer/WebAppTreeItem");
const extensionVariables_1 = require("./extensionVariables");
const LogPointsManager_1 = require("./logPoints/LogPointsManager");
const LogPointsSessionWizard_1 = require("./logPoints/LogPointsSessionWizard");
const remoteScriptDocumentProvider_1 = require("./logPoints/remoteScriptDocumentProvider");
const LogpointsCollection_1 = require("./logPoints/structs/LogpointsCollection");
const IPackageInfo_1 = require("./utils/IPackageInfo");
// tslint:disable-next-line:export-name
// tslint:disable-next-line:max-func-body-length
function activate(context) {
    vscode_azureextensionui_1.registerUIExtensionVariables(extensionVariables_1.ext);
    vscode_azureappservice_1.registerAppServiceExtensionVariables(extensionVariables_1.ext);
    extensionVariables_1.ext.context = context;
    const packageInfo = IPackageInfo_1.getPackageInfo(context);
    if (packageInfo) {
        extensionVariables_1.ext.reporter = new vscode_extension_telemetry_1.default(packageInfo.name, packageInfo.version, packageInfo.aiKey);
        context.subscriptions.push(extensionVariables_1.ext.reporter);
    }
    const ui = new vscode_azureextensionui_1.AzureUserInput(context.globalState);
    extensionVariables_1.ext.ui = ui;
    extensionVariables_1.ext.outputChannel = vscode.window.createOutputChannel("Azure App Service");
    context.subscriptions.push(extensionVariables_1.ext.outputChannel);
    const webAppProvider = new WebAppProvider_1.WebAppProvider();
    const tree = new vscode_azureextensionui_1.AzureTreeDataProvider(webAppProvider, 'appService.LoadMore');
    extensionVariables_1.ext.tree = tree;
    context.subscriptions.push(tree);
    context.subscriptions.push(vscode.window.registerTreeDataProvider('azureAppService', tree));
    const fileEditor = new FileEditor_1.FileEditor();
    context.subscriptions.push(fileEditor);
    // loaded scripts
    const provider = new loadedScriptsExplorer_1.LoadedScriptsProvider(context);
    context.subscriptions.push(vscode.window.registerTreeDataProvider('appservice.loadedScriptsExplorer.jsLogpoints', provider));
    const documentProvider = new remoteScriptDocumentProvider_1.RemoteScriptDocumentProvider();
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(remoteScriptDocumentProvider_1.RemoteScriptSchema.schema, documentProvider));
    const logPointsManager = new LogPointsManager_1.LogPointsManager();
    context.subscriptions.push(logPointsManager);
    const pathIcon = context.asAbsolutePath('resources/logpoint.svg');
    const logpointDecorationType = vscode.window.createTextEditorDecorationType({
        gutterIconPath: pathIcon,
        overviewRulerLane: vscode.OverviewRulerLane.Full,
        overviewRulerColor: "rgba(21, 126, 251, 0.7)"
    });
    context.subscriptions.push(logpointDecorationType);
    LogpointsCollection_1.LogpointsCollection.TextEditorDecorationType = logpointDecorationType;
    const yesButton = { title: 'Yes' };
    const noButton = { title: 'No', isCloseAffordance: true };
    vscode_azureextensionui_1.registerCommand('appService.Refresh', (node) => __awaiter(this, void 0, void 0, function* () { return yield tree.refresh(node); }));
    vscode_azureextensionui_1.registerCommand('appService.selectSubscriptions', () => vscode.commands.executeCommand("azure-account.selectSubscriptions"));
    vscode_azureextensionui_1.registerCommand('appService.LoadMore', (node) => __awaiter(this, void 0, void 0, function* () { return yield tree.loadMore(node); }));
    vscode_azureextensionui_1.registerCommand('appService.Browse', (node) => __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = (yield tree.showNodePicker(WebAppTreeItem_1.WebAppTreeItem.contextValue));
        }
        node.treeItem.browse();
    }));
    vscode_azureextensionui_1.registerCommand('appService.OpenInPortal', (node) => __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = (yield tree.showNodePicker(WebAppTreeItem_1.WebAppTreeItem.contextValue));
        }
        // tslint:disable-next-line:no-non-null-assertion
        node.treeItem.contextValue === DeploymentSlotsTreeItem_1.DeploymentSlotsTreeItem.contextValue ? node.openInPortal(`${node.parent.id}/deploymentSlots`) : node.openInPortal();
        // the deep link for slots does not follow the conventional pattern of including its parent in the path name so this is how we extract the slot's id
    }));
    vscode_azureextensionui_1.registerCommand('appService.Start', (node) => __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = (yield tree.showNodePicker(WebAppTreeItem_1.WebAppTreeItem.contextValue));
        }
        const treeItem = node.treeItem;
        const startingApp = `Starting "${treeItem.client.fullName}"...`;
        const startedApp = `"${treeItem.client.fullName}" has been started.`;
        yield node.runWithTemporaryDescription("Starting...", () => __awaiter(this, void 0, void 0, function* () {
            extensionVariables_1.ext.outputChannel.appendLine(startingApp);
            yield treeItem.client.start();
            extensionVariables_1.ext.outputChannel.appendLine(startedApp);
        }));
    }));
    vscode_azureextensionui_1.registerCommand('appService.Stop', (node) => __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = (yield tree.showNodePicker(WebAppTreeItem_1.WebAppTreeItem.contextValue));
        }
        const treeItem = node.treeItem;
        const stoppingApp = `Stopping "${treeItem.client.fullName}"...`;
        const stoppedApp = `"${treeItem.client.fullName}" has been stopped. App Service plan charges still apply.`;
        yield node.runWithTemporaryDescription("Stopping...", () => __awaiter(this, void 0, void 0, function* () {
            extensionVariables_1.ext.outputChannel.appendLine(stoppingApp);
            yield treeItem.client.stop();
            extensionVariables_1.ext.outputChannel.appendLine(stoppedApp);
        }));
        yield logPointsManager.onAppServiceSiteClosed(node.treeItem.client);
    }));
    vscode_azureextensionui_1.registerCommand('appService.Restart', (node) => __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = (yield tree.showNodePicker(WebAppTreeItem_1.WebAppTreeItem.contextValue));
        }
        yield vscode.commands.executeCommand('appService.Stop', node);
        yield vscode.commands.executeCommand('appService.Start', node);
        yield logPointsManager.onAppServiceSiteClosed(node.treeItem.client);
    }));
    vscode_azureextensionui_1.registerCommand('appService.Delete', (node) => __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = (yield tree.showNodePicker(WebAppTreeItem_1.WebAppTreeItem.contextValue));
        }
        yield node.deleteNode();
    }));
    vscode_azureextensionui_1.registerCommand('appService.CreateWebApp', function (node) {
        return __awaiter(this, void 0, void 0, function* () {
            const deployingToWebApp = 'deployingToWebApp';
            if (!node) {
                node = (yield tree.showNodePicker(vscode_azureextensionui_1.AzureTreeDataProvider.subscriptionContextValue));
            }
            const createdApp = yield node.createChild(this);
            createdApp.treeItem.client.getSiteConfig().then((createdAppConfig) => {
                this.properties.linuxFxVersion = createdAppConfig.linuxFxVersion ? createdAppConfig.linuxFxVersion : 'undefined';
                this.properties.createdFromDeploy = 'false';
            }, () => {
                // ignore
            });
            // prompt user to deploy to newly created web app
            if ((yield vscode.window.showInformationMessage('Deploy to web app?', yesButton, noButton)) === yesButton) {
                this.properties[deployingToWebApp] = 'true';
                yield deploy_1.deploy(this, false, createdApp);
            }
            else {
                this.properties[deployingToWebApp] = 'false';
            }
        });
    });
    vscode_azureextensionui_1.registerCommand('appService.Deploy', function (target) {
        return __awaiter(this, void 0, void 0, function* () {
            yield deploy_1.deploy(this, true, target);
        });
    });
    vscode_azureextensionui_1.registerCommand('appService.ConfigureDeploymentSource', (node) => __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = (yield tree.showNodePicker(WebAppTreeItem_1.WebAppTreeItem.contextValue));
        }
        yield vscode_azureappservice_1.editScmType(node.treeItem.client, node);
    }));
    vscode_azureextensionui_1.registerCommand('appService.OpenVSTSCD', (node) => __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = (yield tree.showNodePicker(WebAppTreeItem_1.WebAppTreeItem.contextValue));
        }
        node.treeItem.openCdInPortal(node);
    }));
    vscode_azureextensionui_1.registerCommand('appService.DeploymentScript', (node) => __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = (yield tree.showNodePicker(WebAppTreeItem_1.WebAppTreeItem.contextValue));
        }
        yield vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, (p) => __awaiter(this, void 0, void 0, function* () {
            p.report({ message: 'Generating script...' });
            // tslint:disable-next-line:no-non-null-assertion
            yield node.treeItem.generateDeploymentScript(node);
        }));
    }));
    vscode_azureextensionui_1.registerCommand('appService.CreateSlot', function (node) {
        return __awaiter(this, void 0, void 0, function* () {
            const deployingToDeploymentSlot = 'deployingToDeploymentSlot';
            if (!node) {
                node = (yield tree.showNodePicker(DeploymentSlotsTreeItem_1.DeploymentSlotsTreeItem.contextValue));
            }
            const createdSlot = yield node.createChild(this);
            // prompt user to deploy to newly created web app
            if ((yield vscode.window.showInformationMessage('Deploy to deployment slot?', yesButton, noButton)) === yesButton) {
                this.properties[deployingToDeploymentSlot] = 'true';
                yield deploy_1.deploy(this, false, createdSlot);
            }
            else {
                this.properties[deployingToDeploymentSlot] = 'false';
            }
        });
    });
    vscode_azureextensionui_1.registerCommand('appService.SwapSlots', (node) => __awaiter(this, void 0, void 0, function* () { return yield swapSlots_1.swapSlots(node); }));
    vscode_azureextensionui_1.registerCommand('appService.appSettings.Add', (node) => __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = (yield tree.showNodePicker(vscode_azureappservice_1.AppSettingsTreeItem.contextValue));
        }
        yield node.createChild();
    }));
    vscode_azureextensionui_1.registerCommand('appService.appSettings.Edit', (node) => __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = (yield tree.showNodePicker(vscode_azureappservice_1.AppSettingTreeItem.contextValue));
        }
        yield node.treeItem.edit(node);
    }));
    vscode_azureextensionui_1.registerCommand('appService.appSettings.Rename', (node) => __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = (yield tree.showNodePicker(vscode_azureappservice_1.AppSettingTreeItem.contextValue));
        }
        yield node.treeItem.rename(node);
    }));
    vscode_azureextensionui_1.registerCommand('appService.appSettings.Delete', (node) => __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = (yield tree.showNodePicker(vscode_azureappservice_1.AppSettingTreeItem.contextValue));
        }
        yield node.deleteNode();
    }));
    vscode_azureextensionui_1.registerCommand('appService.OpenLogStream', startStreamingLogs_1.startStreamingLogs);
    vscode_azureextensionui_1.registerCommand('appService.StopLogStream', (node) => __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = (yield tree.showNodePicker(WebAppTreeItem_1.WebAppTreeItem.contextValue));
        }
        yield vscode_azureappservice_1.stopStreamingLogs(node.treeItem.client);
    }));
    vscode_azureextensionui_1.registerCommand('appService.StartLogPointsSession', function (node) {
        return __awaiter(this, void 0, void 0, function* () {
            if (node) {
                const wizard = new LogPointsSessionWizard_1.LogPointsSessionWizard(logPointsManager, context, extensionVariables_1.ext.outputChannel, node, node.treeItem.client);
                yield wizard.run(this.properties);
            }
        });
    });
    vscode_azureextensionui_1.registerCommand('appService.LogPoints.Toggle', (uri) => __awaiter(this, void 0, void 0, function* () {
        yield logPointsManager.toggleLogpoint(uri);
    }));
    vscode_azureextensionui_1.registerCommand('appService.LogPoints.OpenScript', loadedScriptsExplorer_1.openScript);
    vscode_azureextensionui_1.registerCommand('appService.StartRemoteDebug', (node) => __awaiter(this, void 0, void 0, function* () { return startRemoteDebug_1.startRemoteDebug(node); }));
    vscode_azureextensionui_1.registerCommand('appService.DisableRemoteDebug', (node) => __awaiter(this, void 0, void 0, function* () { return disableRemoteDebug_1.disableRemoteDebug(node); }));
    vscode_azureextensionui_1.registerCommand('appService.showFile', (node) => __awaiter(this, void 0, void 0, function* () {
        const logFiles = 'LogFiles/';
        // we don't want to let users save log files, so rather than using the FileEditor, just open an untitled document
        if (node.treeItem.path.startsWith(logFiles)) {
            const file = yield vscode_azureappservice_1.getFile(node.treeItem.client, node.treeItem.path);
            const document = yield vscode.workspace.openTextDocument({
                language: path_1.extname(node.treeItem.path).substring(1),
                content: file.data
            });
            yield vscode.window.showTextDocument(document);
        }
        else {
            yield fileEditor.showEditor(node);
        }
    }));
    vscode_azureextensionui_1.registerCommand('appService.ScaleUp', (node) => __awaiter(this, void 0, void 0, function* () {
        node.openInPortal(node.treeItem.scaleUpId);
    }));
    vscode_azureextensionui_1.registerEvent('appService.fileEditor.onDidSaveTextDocument', vscode.workspace.onDidSaveTextDocument, function (doc) {
        return __awaiter(this, void 0, void 0, function* () { yield fileEditor.onDidSaveTextDocument(this, context.globalState, doc); });
    });
    vscode_azureextensionui_1.registerCommand('appService.EnableFileLogging', (node) => __awaiter(this, void 0, void 0, function* () {
        if (!node) {
            node = (yield extensionVariables_1.ext.tree.showNodePicker(WebAppTreeItem_1.WebAppTreeItem.contextValue));
        }
        if (node.treeItem instanceof FolderTreeItem_1.FolderTreeItem) {
            // If the entry point was the Files/Log Files node, pass the parent as that's where the logic lives
            node = node.parent;
        }
        // tslint:disable-next-line:no-non-null-assertion
        const siteTreeItem = node.treeItem;
        const isEnabled = yield vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, (p) => __awaiter(this, void 0, void 0, function* () {
            p.report({ message: 'Checking container diagnostics settings...' });
            return yield siteTreeItem.isHttpLogsEnabled();
        }));
        if (!isEnabled) {
            yield enableFileLogging_1.enableFileLogging(node);
        }
        else {
            // tslint:disable-next-line:no-non-null-assertion
            vscode.window.showInformationMessage(`File logging has already been enabled for ${siteTreeItem.client.fullName}.`);
        }
    }));
}
exports.activate = activate;
// tslint:disable-next-line:no-empty
function deactivate() {
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map