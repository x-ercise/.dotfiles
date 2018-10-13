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
const vscode = require("vscode");
const vscode_azureappservice_1 = require("vscode-azureappservice");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const vscode_extension_telemetry_1 = require("vscode-extension-telemetry");
const decryptLocalSettings_1 = require("./commands/appSettings/decryptLocalSettings");
const downloadAppSettings_1 = require("./commands/appSettings/downloadAppSettings");
const encryptLocalSettings_1 = require("./commands/appSettings/encryptLocalSettings");
const uploadAppSettings_1 = require("./commands/appSettings/uploadAppSettings");
const configureDeploymentSource_1 = require("./commands/configureDeploymentSource");
const copyFunctionUrl_1 = require("./commands/copyFunctionUrl");
const createChildNode_1 = require("./commands/createChildNode");
const createFunction_1 = require("./commands/createFunction/createFunction");
const createFunctionApp_1 = require("./commands/createFunctionApp");
const createNewProject_1 = require("./commands/createNewProject/createNewProject");
const initProjectForVSCode_1 = require("./commands/createNewProject/initProjectForVSCode");
const validateFunctionProjects_1 = require("./commands/createNewProject/validateFunctionProjects");
const deleteNode_1 = require("./commands/deleteNode");
const deploy_1 = require("./commands/deploy");
const editAppSetting_1 = require("./commands/editAppSetting");
const startStreamingLogs_1 = require("./commands/logstream/startStreamingLogs");
const stopStreamingLogs_1 = require("./commands/logstream/stopStreamingLogs");
const openInPortal_1 = require("./commands/openInPortal");
const pickFuncProcess_1 = require("./commands/pickFuncProcess");
const remoteDebugFunctionApp_1 = require("./commands/remoteDebugFunctionApp");
const renameAppSetting_1 = require("./commands/renameAppSetting");
const restartFunctionApp_1 = require("./commands/restartFunctionApp");
const startFunctionApp_1 = require("./commands/startFunctionApp");
const stopFunctionApp_1 = require("./commands/stopFunctionApp");
const extensionVariables_1 = require("./extensionVariables");
const installOrUpdateFuncCoreTools_1 = require("./funcCoreTools/installOrUpdateFuncCoreTools");
const uninstallFuncCoreTools_1 = require("./funcCoreTools/uninstallFuncCoreTools");
const validateFuncCoreToolsIsLatest_1 = require("./funcCoreTools/validateFuncCoreToolsIsLatest");
const FunctionTemplates_1 = require("./templates/FunctionTemplates");
const FunctionAppProvider_1 = require("./tree/FunctionAppProvider");
const FunctionAppTreeItem_1 = require("./tree/FunctionAppTreeItem");
const FunctionTreeItem_1 = require("./tree/FunctionTreeItem");
const ProxyTreeItem_1 = require("./tree/ProxyTreeItem");
function activate(context) {
    vscode_azureextensionui_1.registerUIExtensionVariables(extensionVariables_1.ext);
    vscode_azureappservice_1.registerAppServiceExtensionVariables(extensionVariables_1.ext);
    extensionVariables_1.ext.context = context;
    let reporter;
    try {
        const packageInfo = require(context.asAbsolutePath('./package.json'));
        reporter = new vscode_extension_telemetry_1.default(packageInfo.name, packageInfo.version, packageInfo.aiKey);
        extensionVariables_1.ext.reporter = reporter;
    }
    catch (error) {
        // swallow exceptions so that telemetry doesn't affect user
    }
    const outputChannel = vscode.window.createOutputChannel('Azure Functions');
    extensionVariables_1.ext.outputChannel = outputChannel;
    context.subscriptions.push(outputChannel);
    vscode_azureextensionui_1.callWithTelemetryAndErrorHandling('azureFunctions.activate', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.properties.isActivationEvent = 'true';
            const ui = new vscode_azureextensionui_1.AzureUserInput(context.globalState);
            extensionVariables_1.ext.ui = ui;
            // tslint:disable-next-line:no-floating-promises
            validateFuncCoreToolsIsLatest_1.validateFuncCoreToolsIsLatest();
            const tree = new vscode_azureextensionui_1.AzureTreeDataProvider(new FunctionAppProvider_1.FunctionAppProvider(), 'azureFunctions.loadMore');
            extensionVariables_1.ext.tree = tree;
            context.subscriptions.push(tree);
            context.subscriptions.push(vscode.window.registerTreeDataProvider('azureFunctionsExplorer', tree));
            const validateEventId = 'azureFunctions.validateFunctionProjects';
            // tslint:disable-next-line:no-floating-promises
            vscode_azureextensionui_1.callWithTelemetryAndErrorHandling(validateEventId, function () {
                return __awaiter(this, void 0, void 0, function* () {
                    yield validateFunctionProjects_1.validateFunctionProjects(this, ui, outputChannel, vscode.workspace.workspaceFolders);
                });
            });
            vscode_azureextensionui_1.registerEvent(validateEventId, vscode.workspace.onDidChangeWorkspaceFolders, function (event) {
                return __awaiter(this, void 0, void 0, function* () {
                    yield validateFunctionProjects_1.validateFunctionProjects(this, ui, outputChannel, event.added);
                });
            });
            const templatesTask = FunctionTemplates_1.getFunctionTemplates().then((templates) => {
                extensionVariables_1.ext.functionTemplates = templates;
            });
            vscode_azureextensionui_1.registerCommand('azureFunctions.selectSubscriptions', () => vscode.commands.executeCommand('azure-account.selectSubscriptions'));
            vscode_azureextensionui_1.registerCommand('azureFunctions.refresh', (node) => __awaiter(this, void 0, void 0, function* () { return yield tree.refresh(node); }));
            vscode_azureextensionui_1.registerCommand('azureFunctions.pickProcess', function () {
                return __awaiter(this, void 0, void 0, function* () { return yield pickFuncProcess_1.pickFuncProcess(this); });
            });
            vscode_azureextensionui_1.registerCommand('azureFunctions.loadMore', (node) => __awaiter(this, void 0, void 0, function* () { return yield tree.loadMore(node); }));
            vscode_azureextensionui_1.registerCommand('azureFunctions.openInPortal', (node) => __awaiter(this, void 0, void 0, function* () { return yield openInPortal_1.openInPortal(tree, node); }));
            vscode_azureextensionui_1.registerCommand('azureFunctions.createFunction', function (functionAppPath, templateId, functionName, functionSettings) {
                return __awaiter(this, void 0, void 0, function* () {
                    yield templatesTask;
                    yield createFunction_1.createFunction(this, functionAppPath, templateId, functionName, functionSettings);
                });
            });
            vscode_azureextensionui_1.registerCommand('azureFunctions.createNewProject', function (functionAppPath, language, runtime, openFolder, templateId, functionName, functionSettings) {
                return __awaiter(this, void 0, void 0, function* () {
                    yield templatesTask;
                    yield createNewProject_1.createNewProject(this, functionAppPath, language, runtime, openFolder, templateId, functionName, functionSettings);
                });
            });
            vscode_azureextensionui_1.registerCommand('azureFunctions.initProjectForVSCode', function () {
                return __awaiter(this, void 0, void 0, function* () { yield initProjectForVSCode_1.initProjectForVSCode(this, ui, outputChannel); });
            });
            vscode_azureextensionui_1.registerCommand('azureFunctions.createFunctionApp', function (subscription, resourceGroup) {
                return __awaiter(this, void 0, void 0, function* () { return yield createFunctionApp_1.createFunctionApp(this, tree, subscription, resourceGroup); });
            });
            vscode_azureextensionui_1.registerCommand('azureFunctions.startFunctionApp', (node) => __awaiter(this, void 0, void 0, function* () { return yield startFunctionApp_1.startFunctionApp(tree, node); }));
            vscode_azureextensionui_1.registerCommand('azureFunctions.stopFunctionApp', (node) => __awaiter(this, void 0, void 0, function* () { return yield stopFunctionApp_1.stopFunctionApp(tree, node); }));
            vscode_azureextensionui_1.registerCommand('azureFunctions.restartFunctionApp', (node) => __awaiter(this, void 0, void 0, function* () { return yield restartFunctionApp_1.restartFunctionApp(tree, node); }));
            vscode_azureextensionui_1.registerCommand('azureFunctions.deleteFunctionApp', (node) => __awaiter(this, void 0, void 0, function* () { return yield deleteNode_1.deleteNode(tree, FunctionAppTreeItem_1.FunctionAppTreeItem.contextValue, node); }));
            vscode_azureextensionui_1.registerCommand('azureFunctions.deploy', function (deployPath, functionAppId) {
                return __awaiter(this, void 0, void 0, function* () { yield deploy_1.deploy(ui, this, tree, outputChannel, deployPath, functionAppId); });
            });
            vscode_azureextensionui_1.registerCommand('azureFunctions.configureDeploymentSource', function (node) {
                return __awaiter(this, void 0, void 0, function* () { yield configureDeploymentSource_1.configureDeploymentSource(this.properties, tree, node); });
            });
            vscode_azureextensionui_1.registerCommand('azureFunctions.copyFunctionUrl', (node) => __awaiter(this, void 0, void 0, function* () { return yield copyFunctionUrl_1.copyFunctionUrl(tree, node); }));
            vscode_azureextensionui_1.registerCommand('azureFunctions.startStreamingLogs', (node) => __awaiter(this, void 0, void 0, function* () { return yield startStreamingLogs_1.startStreamingLogs(node); }));
            vscode_azureextensionui_1.registerCommand('azureFunctions.stopStreamingLogs', (node) => __awaiter(this, void 0, void 0, function* () { return yield stopStreamingLogs_1.stopStreamingLogs(tree, node); }));
            vscode_azureextensionui_1.registerCommand('azureFunctions.deleteFunction', (node) => __awaiter(this, void 0, void 0, function* () { return yield deleteNode_1.deleteNode(tree, FunctionTreeItem_1.FunctionTreeItem.contextValue, node); }));
            vscode_azureextensionui_1.registerCommand('azureFunctions.appSettings.add', (node) => __awaiter(this, void 0, void 0, function* () { return yield createChildNode_1.createChildNode(tree, vscode_azureappservice_1.AppSettingsTreeItem.contextValue, node); }));
            vscode_azureextensionui_1.registerCommand('azureFunctions.appSettings.download', (node) => __awaiter(this, void 0, void 0, function* () { return yield downloadAppSettings_1.downloadAppSettings(node); }));
            vscode_azureextensionui_1.registerCommand('azureFunctions.appSettings.upload', (node) => __awaiter(this, void 0, void 0, function* () { return yield uploadAppSettings_1.uploadAppSettings(node); }));
            vscode_azureextensionui_1.registerCommand('azureFunctions.appSettings.edit', (node) => __awaiter(this, void 0, void 0, function* () { return yield editAppSetting_1.editAppSetting(tree, node); }));
            vscode_azureextensionui_1.registerCommand('azureFunctions.appSettings.rename', (node) => __awaiter(this, void 0, void 0, function* () { return yield renameAppSetting_1.renameAppSetting(tree, node); }));
            vscode_azureextensionui_1.registerCommand('azureFunctions.appSettings.decrypt', (uri) => __awaiter(this, void 0, void 0, function* () { return yield decryptLocalSettings_1.decryptLocalSettings(uri); }));
            vscode_azureextensionui_1.registerCommand('azureFunctions.appSettings.encrypt', (uri) => __awaiter(this, void 0, void 0, function* () { return yield encryptLocalSettings_1.encryptLocalSettings(uri); }));
            vscode_azureextensionui_1.registerCommand('azureFunctions.appSettings.delete', (node) => __awaiter(this, void 0, void 0, function* () { return yield deleteNode_1.deleteNode(tree, vscode_azureappservice_1.AppSettingTreeItem.contextValue, node); }));
            vscode_azureextensionui_1.registerCommand('azureFunctions.debugFunctionAppOnAzure', (node) => __awaiter(this, void 0, void 0, function* () { return yield remoteDebugFunctionApp_1.remoteDebugFunctionApp(outputChannel, ui, tree, node); }));
            vscode_azureextensionui_1.registerCommand('azureFunctions.deleteProxy', (node) => __awaiter(this, void 0, void 0, function* () { return yield deleteNode_1.deleteNode(tree, ProxyTreeItem_1.ProxyTreeItem.contextValue, node); }));
            vscode_azureextensionui_1.registerCommand('azureFunctions.installOrUpdateFuncCoreTools', () => __awaiter(this, void 0, void 0, function* () { return yield installOrUpdateFuncCoreTools_1.installOrUpdateFuncCoreTools(); }));
            vscode_azureextensionui_1.registerCommand('azureFunctions.uninstallFuncCoreTools', () => __awaiter(this, void 0, void 0, function* () { return yield uninstallFuncCoreTools_1.uninstallFuncCoreTools(); }));
            pickFuncProcess_1.initPickFuncProcess();
        });
    });
}
exports.activate = activate;
// tslint:disable-next-line:no-empty
function deactivate() {
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map