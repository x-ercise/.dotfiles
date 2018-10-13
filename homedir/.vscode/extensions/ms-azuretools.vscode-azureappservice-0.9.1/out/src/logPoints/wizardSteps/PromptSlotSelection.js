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
const vscode = require("vscode");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const DeploymentSlotsTreeItem_1 = require("../../explorer/DeploymentSlotsTreeItem");
const wizard_1 = require("../../wizard");
class PromptSlotSelection extends wizard_1.WizardStep {
    constructor(_wizard, site) {
        super(_wizard, 'Choose a deployment slot.');
        this._wizard = _wizard;
        this.site = site;
    }
    prompt() {
        return __awaiter(this, void 0, void 0, function* () {
            // Decide if this AppService uses deployment slots
            let deploymentSlotsTreeItems = yield vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, (p) => __awaiter(this, void 0, void 0, function* () {
                const message = 'Enumerating deployment slots for the App Service...';
                p.report({ message: message });
                this._wizard.writeline(message);
                return yield this.getDeploymentSlotsTreeItems();
            }));
            this._wizard.writeline(`Got ${deploymentSlotsTreeItems.length} deployment slot(s)`);
            // if there is only one slot, just use that one and don't prompt for user selection.
            if (deploymentSlotsTreeItems.length === 1) {
                this._wizard.selectedDeploymentSlotTreeItem = deploymentSlotsTreeItems[0];
                this._wizard.writeline(`Automatically selected deployment slot ${this._wizard.selectedDeploymentSlot.fullName}.`); // non-null behavior unknown. Should be handled by logPoints team
                return;
            }
            const deploymentQuickPickItems = deploymentSlotsTreeItems.map((deploymentSlotTreeItem) => {
                return {
                    label: deploymentSlotTreeItem.label,
                    description: '',
                    data: deploymentSlotTreeItem
                };
            });
            const quickPickOption = { placeHolder: `Please select a deployment slot: (${this.stepProgressText})` };
            let pickedItem;
            try {
                pickedItem = yield this.showQuickPick(deploymentQuickPickItems, quickPickOption);
            }
            catch (e) {
                if (e instanceof vscode_azureextensionui_1.UserCancelledError) {
                    vscode.window.showInformationMessage('Please select a deployment slot.');
                }
                throw e;
            }
            this._wizard.selectedDeploymentSlotTreeItem = pickedItem.data;
            this._wizard.writeline(`The deployment slot you selected is: ${this._wizard.selectedDeploymentSlot.fullName}`); // non-null behavior unknown. Should be handled by logPoints team
        });
    }
    /**
     * Returns all the deployment slots and the production slot.
     */
    getDeploymentSlotsTreeItems() {
        return __awaiter(this, void 0, void 0, function* () {
            const appServiceTreeItem = this._wizard.uiTreeItem;
            const result = yield appServiceTreeItem.getCachedChildren();
            let deploymentSlotsCategoryNode;
            if (!result || result.length <= 0) {
                throw new Error('Cannot find any tree node under the App Service node.');
            }
            result.forEach((treeNode) => {
                if (treeNode.treeItem instanceof DeploymentSlotsTreeItem_1.DeploymentSlotsTreeItem) {
                    deploymentSlotsCategoryNode = treeNode;
                }
            });
            if (!deploymentSlotsCategoryNode) {
                throw new Error('Cannot find the Deployment Slots tree node');
            }
            const deploymentSlotTreeNodes = yield deploymentSlotsCategoryNode.getCachedChildren();
            const deploymentSlotTreeItems = deploymentSlotTreeNodes.map((node) => {
                return node.treeItem;
            });
            return [this._wizard.uiTreeItem.treeItem].concat(deploymentSlotTreeItems);
        });
    }
}
exports.PromptSlotSelection = PromptSlotSelection;
//# sourceMappingURL=PromptSlotSelection.js.map