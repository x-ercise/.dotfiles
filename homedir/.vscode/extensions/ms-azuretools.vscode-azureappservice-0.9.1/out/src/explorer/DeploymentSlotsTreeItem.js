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
const path = require("path");
const vscode_azureappservice_1 = require("vscode-azureappservice");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const extensionVariables_1 = require("../extensionVariables");
const DeploymentSlotTreeItem_1 = require("./DeploymentSlotTreeItem");
class DeploymentSlotsTreeItem {
    constructor(client) {
        this.contextValue = DeploymentSlotsTreeItem.contextValue;
        this.label = 'Deployment Slots';
        this.childTypeLabel = 'Deployment Slot';
        this.client = client;
    }
    get iconPath() {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'DeploymentSlots_color.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'DeploymentSlots_color.svg')
        };
    }
    get id() {
        return `${this.client.id}/slots`;
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
            const webAppCollection = this._nextLink === undefined ?
                yield client.webApps.listSlots(this.client.resourceGroup, this.client.siteName) :
                yield client.webApps.listSlotsNext(this._nextLink);
            this._nextLink = webAppCollection.nextLink;
            return webAppCollection.map((s) => new DeploymentSlotTreeItem_1.DeploymentSlotTreeItem(new vscode_azureappservice_1.SiteClient(s, node)));
        });
    }
    createChild(node, showCreatingNode) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = new azure_arm_website_1.WebSiteManagementClient(node.credentials, node.subscriptionId, node.environment.resourceManagerEndpointUrl);
            vscode_azureextensionui_1.addExtensionUserAgent(client);
            let slotName = yield this.promptForSlotName(client);
            if (!slotName) {
                throw new vscode_azureextensionui_1.UserCancelledError();
            }
            slotName = slotName.trim();
            const newDeploymentSlot = {
                name: slotName,
                kind: this.client.kind,
                location: this.client.location,
                serverFarmId: this.client.serverFarmId,
                siteConfig: {
                    appSettings: [] // neccesary to have clean appSettings; by default it copies the production's slot
                }
            };
            const configurationSource = yield this.chooseConfigurationSource(node);
            if (!!configurationSource) {
                const appSettings = yield this.parseAppSettings(configurationSource);
                // tslint:disable-next-line:no-non-null-assertion
                newDeploymentSlot.siteConfig.appSettings = appSettings;
            }
            showCreatingNode(slotName);
            // if user has more slots than the service plan allows, Azure will respond with an error
            const newSite = yield client.webApps.createOrUpdateSlot(this.client.resourceGroup, this.client.siteName, newDeploymentSlot, slotName);
            return new DeploymentSlotTreeItem_1.DeploymentSlotTreeItem(new vscode_azureappservice_1.SiteClient(newSite, node));
        });
    }
    promptForSlotName(client) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield extensionVariables_1.ext.ui.showInputBox({
                prompt: 'Enter a unique name for the new deployment slot',
                ignoreFocusOut: true,
                validateInput: (value) => __awaiter(this, void 0, void 0, function* () {
                    value = value ? value.trim() : '';
                    // Can not have "production" as a slot name, but checkNameAvailability doesn't validate that
                    if (value === 'production') {
                        return `The slot name "${value}" is not available.`;
                    }
                    const nameAvailability = yield client.checkNameAvailability(`${this.client.siteName}-${value}`, 'Slot');
                    if (!nameAvailability.nameAvailable) {
                        return nameAvailability.message;
                    }
                    return null;
                })
            });
        });
    }
    chooseConfigurationSource(node) {
        return __awaiter(this, void 0, void 0, function* () {
            const deploymentSlots = yield node.getCachedChildren();
            const configurationSources = [{
                    label: "Don't clone configuration from an existing slot",
                    description: '',
                    data: undefined
                }];
            // tslint:disable-next-line:no-non-null-assertion
            const prodSiteClient = node.parent.treeItem.client;
            // add the production slot itself
            configurationSources.push({
                // tslint:disable-next-line:no-non-null-assertion
                label: prodSiteClient.fullName,
                description: '',
                data: prodSiteClient
            });
            // add the web app's current deployment slots
            for (const slot of deploymentSlots) {
                const slotSiteClient = slot.treeItem.client;
                configurationSources.push({
                    label: slotSiteClient.fullName,
                    description: '',
                    data: slotSiteClient
                });
            }
            const quickPickOptions = { placeHolder: `Choose a configuration source.`, ignoreFocusOut: true };
            return (yield extensionVariables_1.ext.ui.showQuickPick(configurationSources, quickPickOptions)).data;
        });
    }
    parseAppSettings(siteClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const appSettings = yield siteClient.listApplicationSettings();
            const appSettingPairs = [];
            if (appSettings.properties) {
                // iterate String Dictionary to parse into NameValuePair[]
                for (const key of Object.keys(appSettings.properties)) {
                    appSettingPairs.push({ name: key, value: appSettings.properties[key] });
                }
            }
            return appSettingPairs;
        });
    }
}
DeploymentSlotsTreeItem.contextValue = 'deploymentSlots';
exports.DeploymentSlotsTreeItem = DeploymentSlotsTreeItem;
class ScaleUpTreeItem {
    constructor(scaleUpId) {
        this.label = "Scale up App Service Plan...";
        this.contextValue = "ScaleUp";
        this.commandId = 'appService.ScaleUp';
        this.scaleUpId = scaleUpId;
    }
}
exports.ScaleUpTreeItem = ScaleUpTreeItem;
class DeploymentSlotsNATreeItem {
    constructor(tier, planId) {
        this.contextValue = DeploymentSlotsNATreeItem.contextValue;
        this.id = DeploymentSlotsNATreeItem.contextValue;
        this.label = `Deployment Slots (N/A for ${tier} Service Plan)`;
        this.scaleUpId = `${planId}/pricingTier`;
    }
    get iconPath() {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'DeploymentSlots_grayscale.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'DeploymentSlots_grayscale.svg')
        };
    }
    hasMoreChildren() {
        return false;
    }
    loadMoreChildren(_node) {
        return __awaiter(this, void 0, void 0, function* () {
            return [new ScaleUpTreeItem(this.scaleUpId)];
        });
    }
}
DeploymentSlotsNATreeItem.contextValue = "deploymentNASlots";
exports.DeploymentSlotsNATreeItem = DeploymentSlotsNATreeItem;
//# sourceMappingURL=DeploymentSlotsTreeItem.js.map