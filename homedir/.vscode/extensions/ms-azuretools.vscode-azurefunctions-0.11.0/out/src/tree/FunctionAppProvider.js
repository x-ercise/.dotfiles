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
const azure_arm_website_1 = require("azure-arm-website");
const vscode_azureappservice_1 = require("vscode-azureappservice");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const constants_1 = require("../constants");
const tryGetLocalRuntimeVersion_1 = require("../funcCoreTools/tryGetLocalRuntimeVersion");
const localize_1 = require("../localize");
const ProjectSettings_1 = require("../ProjectSettings");
const getCliFeedJson_1 = require("../utils/getCliFeedJson");
const FunctionAppTreeItem_1 = require("./FunctionAppTreeItem");
class FunctionAppProvider {
    constructor() {
        this.childTypeLabel = localize_1.localize('azFunc.FunctionApp', 'Function App');
    }
    hasMoreChildren() {
        return this._nextLink !== undefined;
    }
    loadMoreChildren(node, clearCache) {
        return __awaiter(this, void 0, void 0, function* () {
            if (clearCache) {
                this._nextLink = undefined;
            }
            const client = new azure_arm_website_1.WebSiteManagementClient(node.credentials, node.subscriptionId, node.environment.resourceManagerEndpointUrl);
            vscode_azureextensionui_1.addExtensionUserAgent(client);
            let webAppCollection;
            try {
                webAppCollection = this._nextLink === undefined ?
                    yield client.webApps.list() :
                    yield client.webApps.listNext(this._nextLink);
            }
            catch (error) {
                if (vscode_azureextensionui_1.parseError(error).errorType.toLowerCase() === 'notfound') {
                    // This error type means the 'Microsoft.Web' provider has not been registered in this subscription
                    // In that case, we know there are no function apps, so we can return an empty array
                    // (The provider will be registered automatically if the user creates a new function app)
                    return [];
                }
                else {
                    throw error;
                }
            }
            this._nextLink = webAppCollection.nextLink;
            return yield vscode_azureextensionui_1.createTreeItemsWithErrorHandling(webAppCollection, 'azFuncInvalidFunctionApp', (site) => __awaiter(this, void 0, void 0, function* () {
                const siteClient = new vscode_azureappservice_1.SiteClient(site, node);
                if (siteClient.isFunctionApp) {
                    const asp = yield siteClient.getAppServicePlan();
                    const isLinuxPreview = siteClient.kind.toLowerCase().includes('linux') && !!asp.sku && !!asp.sku.tier && asp.sku.tier.toLowerCase() === 'dynamic';
                    return new FunctionAppTreeItem_1.FunctionAppTreeItem(siteClient, isLinuxPreview);
                }
                return undefined;
            }), (site) => {
                return site.name;
            });
        });
    }
    createChild(parent, showCreatingNode, userOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            // Ideally actionContext should always be defined, but there's a bug with the NodePicker. Create a 'fake' actionContext until that bug is fixed
            // https://github.com/Microsoft/vscode-azuretools/issues/120
            // tslint:disable-next-line:strict-boolean-expressions
            const actionContext = userOptions ? userOptions.actionContext : { properties: {}, measurements: {} };
            const resourceGroup = userOptions ? userOptions.resourceGroup : undefined;
            const runtime = yield getDefaultRuntime(actionContext);
            const functionAppSettings = yield getCliFeedJson_1.getCliFeedAppSettings(runtime);
            const language = ProjectSettings_1.getFuncExtensionSetting(constants_1.projectLanguageSetting);
            const createOptions = { functionAppSettings, resourceGroup };
            // There are two things in preview right now:
            // 1. Python support
            // 2. Linux support
            // Python only works on Linux, so we have to use Linux when creating a function app. For other languages, we will stick with Windows until Linux GA's
            if (language === constants_1.ProjectLanguage.Python) {
                createOptions.os = 'linux';
                createOptions.runtime = 'python';
            }
            else {
                createOptions.os = 'windows';
                // WEBSITE_RUN_FROM_PACKAGE has several benefits, so make that the default
                // https://docs.microsoft.com/en-us/azure/azure-functions/run-functions-from-deployment-package
                functionAppSettings.WEBSITE_RUN_FROM_PACKAGE = '1';
            }
            const site = yield vscode_azureappservice_1.createFunctionApp(actionContext, parent, createOptions, showCreatingNode);
            return new FunctionAppTreeItem_1.FunctionAppTreeItem(new vscode_azureappservice_1.SiteClient(site, parent), createOptions.os === 'linux' /* isLinuxPreview */);
        });
    }
}
exports.FunctionAppProvider = FunctionAppProvider;
function getDefaultRuntime(actionContext) {
    return __awaiter(this, void 0, void 0, function* () {
        // Try to get VS Code setting for runtime (aka if they have a project open)
        let runtime = ProjectSettings_1.convertStringToRuntime(ProjectSettings_1.getFuncExtensionSetting(constants_1.projectRuntimeSetting));
        actionContext.properties.runtimeSource = 'VSCodeSetting';
        if (!runtime) {
            // Try to get the runtime that matches their local func cli version
            runtime = yield tryGetLocalRuntimeVersion_1.tryGetLocalRuntimeVersion();
            actionContext.properties.runtimeSource = 'LocalFuncCli';
        }
        if (!runtime) {
            // Default to v2 if all else fails
            runtime = constants_1.ProjectRuntime.v2;
            actionContext.properties.runtimeSource = 'Backup';
        }
        actionContext.properties.projectRuntime = runtime;
        return runtime;
    });
}
//# sourceMappingURL=FunctionAppProvider.js.map