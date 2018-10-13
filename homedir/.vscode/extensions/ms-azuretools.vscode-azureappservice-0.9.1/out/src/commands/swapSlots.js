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
const vscode_1 = require("vscode");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const DeploymentSlotTreeItem_1 = require("../explorer/DeploymentSlotTreeItem");
const extensionVariables_1 = require("../extensionVariables");
function swapSlots(sourceSlotNode) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!sourceSlotNode) {
            sourceSlotNode = (yield extensionVariables_1.ext.tree.showNodePicker(DeploymentSlotTreeItem_1.DeploymentSlotTreeItem.contextValue));
        }
        const sourceSlotClient = sourceSlotNode.treeItem.client;
        const productionSlotLabel = 'production';
        // tslint:disable-next-line:no-non-null-assertion
        const deploymentSlots = yield sourceSlotNode.parent.getCachedChildren();
        const otherSlots = [{
                label: productionSlotLabel,
                description: 'Swap slot with production',
                detail: '',
                data: undefined
            }];
        for (const slot of deploymentSlots) {
            if (sourceSlotClient.slotName !== slot.treeItem.client.slotName) {
                // Deployment slots must have an unique name
                const otherSlot = {
                    // tslint:disable-next-line:no-non-null-assertion
                    label: slot.treeItem.client.slotName,
                    description: '',
                    data: slot.treeItem
                };
                otherSlots.push(otherSlot);
            }
        }
        const quickPickOptions = { placeHolder: `Select which slot to swap with "${sourceSlotClient.slotName}".` };
        const targetSlot = (yield extensionVariables_1.ext.ui.showQuickPick(otherSlots, quickPickOptions)).data;
        // tslint:disable-next-line:no-non-null-assertion
        const targetSlotLabel = targetSlot ? targetSlot.client.fullName : `${sourceSlotClient.siteName}-${productionSlotLabel}`;
        const swappingSlots = `Swapping "${targetSlotLabel}" with "${sourceSlotClient.fullName}"...`;
        const successfullySwapped = `Successfully swapped "${targetSlotLabel}" with "${sourceSlotClient.fullName}".`;
        extensionVariables_1.ext.outputChannel.appendLine(swappingSlots);
        const client = new azure_arm_website_1.WebSiteManagementClient(sourceSlotNode.credentials, sourceSlotNode.subscriptionId, sourceSlotNode.environment.resourceManagerEndpointUrl);
        vscode_azureextensionui_1.addExtensionUserAgent(client);
        yield vscode_1.window.withProgress({ location: vscode_1.ProgressLocation.Notification, title: swappingSlots }, () => __awaiter(this, void 0, void 0, function* () {
            // if targetSlot was assigned undefined, the user selected 'production'
            if (!targetSlot) {
                // tslint:disable-next-line:no-non-null-assertion
                yield client.webApps.swapSlotWithProduction(sourceSlotClient.resourceGroup, sourceSlotClient.siteName, { targetSlot: sourceSlotClient.slotName, preserveVnet: true });
            }
            else {
                // tslint:disable-next-line:no-non-null-assertion
                yield client.webApps.swapSlotSlot(sourceSlotClient.resourceGroup, sourceSlotClient.siteName, { targetSlot: targetSlot.client.slotName, preserveVnet: true }, sourceSlotClient.slotName);
            }
            vscode_1.window.showInformationMessage(successfullySwapped);
            extensionVariables_1.ext.outputChannel.appendLine(successfullySwapped);
        }));
    });
}
exports.swapSlots = swapSlots;
//# sourceMappingURL=swapSlots.js.map