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
const azure_arm_cosmosdb_1 = require("azure-arm-cosmosdb");
const azure_arm_sb_1 = require("azure-arm-sb");
// tslint:disable-next-line:no-require-imports
const StorageClient = require("azure-arm-storage");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const errors_1 = require("../errors");
const extensionVariables_1 = require("../extensionVariables");
const localize_1 = require("../localize");
const IFunctionSetting_1 = require("../templates/IFunctionSetting");
const nonNull_1 = require("./nonNull");
function parseResourceId(id) {
    const matches = id.match(/\/subscriptions\/(.*)\/resourceGroups\/(.*)\/providers\/(.*)\/(.*)/);
    if (matches === null || matches.length < 3) {
        throw new Error(localize_1.localize('azFunc.InvalidResourceId', 'Invalid Azure Resource Id'));
    }
    return matches;
}
function getResourceGroupFromId(id) {
    return parseResourceId(id)[2];
}
exports.getResourceGroupFromId = getResourceGroupFromId;
function getSubscriptionFromId(id) {
    return parseResourceId(id)[1];
}
exports.getSubscriptionFromId = getSubscriptionFromId;
function getNameFromId(id) {
    return parseResourceId(id)[4];
}
exports.getNameFromId = getNameFromId;
function promptForResource(ui, resourceType, resourcesTask) {
    return __awaiter(this, void 0, void 0, function* () {
        const picksTask = resourcesTask.then((resources) => {
            return (resources
                .map((r) => r.name ? { data: r, label: r.name } : undefined)
                .filter((p) => p));
        });
        const options = { placeHolder: localize_1.localize('azFunc.resourcePrompt', 'Select a \'{0}\'', resourceType) };
        return (yield ui.showQuickPick(picksTask, options)).data;
    });
}
function promptForCosmosDBAccount() {
    return __awaiter(this, void 0, void 0, function* () {
        const resourceTypeLabel = IFunctionSetting_1.getResourceTypeLabel(IFunctionSetting_1.ResourceType.DocumentDB);
        const node = yield extensionVariables_1.ext.tree.showNodePicker(vscode_azureextensionui_1.AzureTreeDataProvider.subscriptionContextValue);
        const client = new azure_arm_cosmosdb_1.CosmosDBManagementClient(node.credentials, node.subscriptionId, node.environment.resourceManagerEndpointUrl);
        vscode_azureextensionui_1.addExtensionUserAgent(client);
        const dbAccount = yield promptForResource(extensionVariables_1.ext.ui, resourceTypeLabel, client.databaseAccounts.list());
        if (!dbAccount.id || !dbAccount.name) {
            throw new errors_1.ArgumentError(dbAccount);
        }
        else {
            const resourceGroup = getResourceGroupFromId(dbAccount.id);
            const keys = yield client.databaseAccounts.listKeys(resourceGroup, dbAccount.name);
            return {
                name: dbAccount.name,
                connectionString: `AccountEndpoint=${dbAccount.documentEndpoint};AccountKey=${keys.primaryMasterKey};`
            };
        }
    });
}
exports.promptForCosmosDBAccount = promptForCosmosDBAccount;
function promptForStorageAccount(actionContext, filterOptions) {
    return __awaiter(this, void 0, void 0, function* () {
        const node = yield extensionVariables_1.ext.tree.showNodePicker(vscode_azureextensionui_1.AzureTreeDataProvider.subscriptionContextValue);
        const wizardContext = {
            credentials: node.credentials,
            subscriptionId: node.subscriptionId,
            subscriptionDisplayName: node.subscriptionDisplayName,
            environment: node.environment
        };
        const wizard = new vscode_azureextensionui_1.AzureWizard([new vscode_azureextensionui_1.StorageAccountListStep({ kind: vscode_azureextensionui_1.StorageAccountKind.Storage, performance: vscode_azureextensionui_1.StorageAccountPerformance.Standard, replication: vscode_azureextensionui_1.StorageAccountReplication.LRS }, filterOptions)], [], wizardContext);
        yield wizard.prompt(actionContext);
        yield wizard.execute(actionContext);
        const client = new StorageClient(node.credentials, node.subscriptionId, node.environment.resourceManagerEndpointUrl);
        vscode_azureextensionui_1.addExtensionUserAgent(client);
        // tslint:disable-next-line:no-non-null-assertion
        const storageAccount = wizardContext.storageAccount;
        if (!storageAccount.id || !storageAccount.name) {
            throw new errors_1.ArgumentError(storageAccount);
        }
        else {
            const resourceGroup = getResourceGroupFromId(storageAccount.id);
            const result = yield client.storageAccounts.listKeys(resourceGroup, storageAccount.name);
            if (!result.keys || result.keys.length === 0) {
                throw new errors_1.ArgumentError(result);
            }
            return {
                name: storageAccount.name,
                connectionString: `DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${result.keys[0].value}`,
                id: storageAccount.id
            };
        }
    });
}
exports.promptForStorageAccount = promptForStorageAccount;
function promptForServiceBus() {
    return __awaiter(this, void 0, void 0, function* () {
        const resourceTypeLabel = IFunctionSetting_1.getResourceTypeLabel(IFunctionSetting_1.ResourceType.ServiceBus);
        const node = yield extensionVariables_1.ext.tree.showNodePicker(vscode_azureextensionui_1.AzureTreeDataProvider.subscriptionContextValue);
        const client = vscode_azureextensionui_1.createAzureClient(node, azure_arm_sb_1.ServiceBusManagementClient);
        const resource = yield promptForResource(extensionVariables_1.ext.ui, resourceTypeLabel, client.namespaces.list());
        const id = nonNull_1.nonNullProp(resource, 'id');
        const name = nonNull_1.nonNullProp(resource, 'name');
        const resourceGroup = getResourceGroupFromId(id);
        const authRules = yield client.namespaces.listAuthorizationRules(resourceGroup, name);
        const authRule = authRules.find((ar) => ar.rights.some((r) => r.toLowerCase() === 'listen'));
        if (!authRule) {
            throw new Error(localize_1.localize('noAuthRule', 'Failed to get connection string for Service Bus namespace "{0}".', name));
        }
        const keys = yield client.namespaces.listKeys(resourceGroup, name, nonNull_1.nonNullProp(authRule, 'name'));
        return {
            name: name,
            connectionString: nonNull_1.nonNullProp(keys, 'primaryConnectionString')
        };
    });
}
exports.promptForServiceBus = promptForServiceBus;
//# sourceMappingURL=azure.js.map