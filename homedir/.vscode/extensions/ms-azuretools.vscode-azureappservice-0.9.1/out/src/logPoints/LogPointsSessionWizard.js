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
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const wizard_1 = require("../wizard");
const logPointsClient_1 = require("./logPointsClient");
const ActivateSite_1 = require("./wizardSteps/ActivateSite");
const EligibilityCheck_1 = require("./wizardSteps/EligibilityCheck");
const GetUnoccupiedInstance_1 = require("./wizardSteps/GetUnoccupiedInstance");
const OpenStreamingLog_1 = require("./wizardSteps/OpenStreamingLog");
const PickProcessStep_1 = require("./wizardSteps/PickProcessStep");
const PromptSlotSelection_1 = require("./wizardSteps/PromptSlotSelection");
const SessionAttachStep_1 = require("./wizardSteps/SessionAttachStep");
const StartDebugAdapterStep_1 = require("./wizardSteps/StartDebugAdapterStep");
const logPointsDebuggerClient = logPointsClient_1.createDefaultClient();
// tslint:disable-next-line:export-name
class LogPointsSessionWizard extends wizard_1.WizardBase {
    constructor(logpointsManager, extensionContext, output, uiTreeItem, client) {
        super(output);
        this.logpointsManager = logpointsManager;
        this.extensionContext = extensionContext;
        this.uiTreeItem = uiTreeItem;
        this.client = client;
    }
    get selectedDeploymentSlot() {
        return this.selectedDeploymentSlotTreeItem ? this.selectedDeploymentSlotTreeItem.client : undefined;
    }
    get lastUsedPublishCredential() {
        return this._cachedPublishCredential;
    }
    fetchPublishCrentential(client) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield client.getWebAppPublishCredential();
            this._cachedPublishCredential = user;
            return user;
        });
    }
    getCachedCredentialOrRefetch(client) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.lastUsedPublishCredential) {
                return Promise.resolve(this.lastUsedPublishCredential);
            }
            return this.fetchPublishCrentential(client);
        });
    }
    initSteps() {
        this.steps.push(new EligibilityCheck_1.EligibilityCheck(this));
        if (this.client.isSlot) {
            this.selectedDeploymentSlotTreeItem = this.uiTreeItem.treeItem;
        }
        else {
            this.steps.push(new PromptSlotSelection_1.PromptSlotSelection(this, this.client));
        }
        this.steps.push(new OpenStreamingLog_1.OpenStreamingLog(this));
        this.steps.push(new ActivateSite_1.ActivateSite(this));
        this.steps.push(new GetUnoccupiedInstance_1.GetUnoccupiedInstance(this, logPointsDebuggerClient));
        this.steps.push(new PickProcessStep_1.PickProcessStep(this, logPointsDebuggerClient));
        this.steps.push(new SessionAttachStep_1.SessionAttachStep(this, logPointsDebuggerClient));
        this.steps.push(new StartDebugAdapterStep_1.StartDebugAdapterStep(this));
        this.output.show();
    }
    onExecuteError(error) {
        if (error instanceof vscode_azureextensionui_1.UserCancelledError) {
            return;
        }
        this.writeline(`Starting Log Points Session failed - ${error.message}`);
        this.writeline('');
    }
}
exports.LogPointsSessionWizard = LogPointsSessionWizard;
//# sourceMappingURL=LogPointsSessionWizard.js.map