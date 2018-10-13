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
const azure_arm_resource_1 = require("azure-arm-resource");
const fs = require("fs-extra");
const path = require("path");
const vscode = require("vscode");
const vscode_azureappservice_1 = require("vscode-azureappservice");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const constants_1 = require("../constants");
const DeploymentSlotsTreeItem_1 = require("./DeploymentSlotsTreeItem");
const DeploymentSlotTreeItem_1 = require("./DeploymentSlotTreeItem");
const FolderTreeItem_1 = require("./FolderTreeItem");
const SiteTreeItem_1 = require("./SiteTreeItem");
const WebJobsTreeItem_1 = require("./WebJobsTreeItem");
class WebAppTreeItem extends SiteTreeItem_1.SiteTreeItem {
    constructor(client) {
        super(client);
        this.contextValue = WebAppTreeItem.contextValue;
        this.folderNode = new FolderTreeItem_1.FolderTreeItem(this.client, 'Files', "/site/wwwroot");
        this.logFolderNode = new FolderTreeItem_1.FolderTreeItem(this.client, 'Log Files', '/LogFiles', 'logFolder');
        this.webJobsNode = new WebJobsTreeItem_1.WebJobsTreeItem(this.client);
        this.appSettingsNode = new vscode_azureappservice_1.AppSettingsTreeItem(this.client);
    }
    get iconPath() {
        const iconName = 'WebApp_color.svg';
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', iconName),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', iconName)
        };
    }
    loadMoreChildren(_parentNode) {
        return __awaiter(this, void 0, void 0, function* () {
            const appServicePlan = yield this.client.getAppServicePlan();
            // tslint:disable-next-line:no-non-null-assertion
            const tier = String(appServicePlan.sku.tier);
            // tslint:disable-next-line:no-non-null-assertion
            this.deploymentSlotsNode = /^(basic|free|shared)$/i.test(tier) ? new DeploymentSlotsTreeItem_1.DeploymentSlotsNATreeItem(tier, appServicePlan.id) : new DeploymentSlotsTreeItem_1.DeploymentSlotsTreeItem(this.client);
            return [this.deploymentSlotsNode, this.folderNode, this.logFolderNode, this.webJobsNode, this.appSettingsNode];
        });
    }
    pickTreeItem(expectedContextValue) {
        switch (expectedContextValue) {
            case DeploymentSlotsTreeItem_1.DeploymentSlotsTreeItem.contextValue:
            case DeploymentSlotTreeItem_1.DeploymentSlotTreeItem.contextValue:
                return this.deploymentSlotsNode;
            case vscode_azureappservice_1.AppSettingsTreeItem.contextValue:
            case vscode_azureappservice_1.AppSettingTreeItem.contextValue:
                return this.appSettingsNode;
            case FolderTreeItem_1.FolderTreeItem.contextValue:
                return this.folderNode;
            case WebJobsTreeItem_1.WebJobsTreeItem.contextValue:
                return this.webJobsNode;
            default:
                return undefined;
        }
    }
    openCdInPortal(node) {
        node.openInPortal(`${this.client.id}/vstscd`);
    }
    generateDeploymentScript(node) {
        return __awaiter(this, void 0, void 0, function* () {
            const resourceClient = new azure_arm_resource_1.ResourceManagementClient(node.credentials, node.subscriptionId, node.environment.resourceManagerEndpointUrl);
            vscode_azureextensionui_1.addExtensionUserAgent(resourceClient);
            const tasks = Promise.all([
                resourceClient.resourceGroups.get(this.client.resourceGroup),
                this.client.getAppServicePlan(),
                this.client.getSiteConfig(),
                this.client.listApplicationSettings()
            ]);
            const taskResults = yield tasks;
            const rg = taskResults[0];
            const plan = taskResults[1];
            const siteConfig = taskResults[2];
            const appSettings = taskResults[3];
            let script;
            if (!siteConfig.linuxFxVersion) {
                const scriptTemplate = yield this.loadScriptTemplate('windows-default.sh');
                script = scriptTemplate;
            }
            else if (siteConfig.linuxFxVersion.toLowerCase().startsWith('docker')) {
                const scriptTemplate = yield this.loadScriptTemplate('docker-image.sh');
                let serverUrl;
                let serverUser;
                let serverPwd;
                if (appSettings.properties) {
                    serverUrl = appSettings.properties.DOCKER_REGISTRY_SERVER_URL;
                    serverUser = appSettings.properties.DOCKER_REGISTRY_SERVER_USERNAME;
                    serverPwd = appSettings.properties.DOCKER_REGISTRY_SERVER_PASSWORD;
                }
                const containerParameters = (serverUrl ? `SERVERURL="${serverUrl}"\n` : '') +
                    (serverUser ? `SERVERUSER="${serverUser}"\n` : '') +
                    (serverPwd ? `SERVERPASSWORD="*****"\n` : '');
                const containerCmdParameters = (serverUrl ? '--docker-registry-server-url $SERVERURL ' : '') +
                    (serverUser ? '--docker-registry-server-user $SERVERUSER ' : '') +
                    (serverPwd ? '--docker-registry-server-password $SERVERPASSWORD ' : '');
                script = scriptTemplate.replace('%RUNTIME%', siteConfig.linuxFxVersion)
                    .replace('%IMAGENAME%', siteConfig.linuxFxVersion.substring(siteConfig.linuxFxVersion.indexOf('|') + 1))
                    .replace('%DOCKER_PARA%', containerParameters)
                    .replace('%CTN_CMD_PARA%', containerCmdParameters);
            }
            else { // Stock linux image
                const scriptTemplate = yield this.loadScriptTemplate('linux-default.sh');
                script = scriptTemplate.replace('%RUNTIME%', siteConfig.linuxFxVersion);
            }
            // tslint:disable:no-non-null-assertion
            script = script.replace('%SUBSCRIPTION_NAME%', node.subscriptionDisplayName)
                .replace('%RG_NAME%', rg.name)
                .replace('%LOCATION%', rg.location)
                .replace('%PLAN_NAME%', plan.name)
                .replace('%PLAN_SKU%', plan.sku.name)
                .replace('%SITE_NAME%', this.client.siteName);
            // tslint:enable:no-non-null-assertion
            const doc = yield vscode.workspace.openTextDocument({ language: 'shellscript', content: script });
            yield vscode.window.showTextDocument(doc);
        });
    }
    loadScriptTemplate(scriptName) {
        return __awaiter(this, void 0, void 0, function* () {
            const templatePath = path.join(__filename, '..', '..', '..', '..', 'resources', 'deploymentScripts', scriptName);
            return yield fs.readFile(templatePath, 'utf8');
        });
    }
}
WebAppTreeItem.contextValue = constants_1.extensionPrefix;
exports.WebAppTreeItem = WebAppTreeItem;
//# sourceMappingURL=WebAppTreeItem.js.map