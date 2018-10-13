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
const logpointsUtil_1 = require("../../utils/logpointsUtil");
const wizard_1 = require("../../wizard");
class PickProcessStep extends wizard_1.WizardStep {
    constructor(_wizard, _logPointsDebuggerClient) {
        super(_wizard, 'Enumerate node processes.');
        this._wizard = _wizard;
        this._logPointsDebuggerClient = _logPointsDebuggerClient;
    }
    prompt() {
        return __awaiter(this, void 0, void 0, function* () {
            const selectedSlot = this.wizard.selectedDeploymentSlot; // non-null behavior unknown. Should be handled by logPoints team
            const instance = this._wizard.selectedInstance;
            const publishCredential = yield this._wizard.getCachedCredentialOrRefetch(selectedSlot);
            let result = yield vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, (p) => __awaiter(this, void 0, void 0, function* () {
                const message = `Enumerate node processes from instance ${instance.name}...`;
                p.report({ message: message });
                this._wizard.writeline(message);
                return yield logpointsUtil_1.callWithTimeout(() => {
                    return this._logPointsDebuggerClient.enumerateProcesses(selectedSlot.fullName, instance.name, publishCredential); // non-null behavior unknown. Should be handled by logPoints team
                }, logpointsUtil_1.DEFAULT_TIMEOUT);
            }));
            if (!result.isSuccessful() || result.json.data.length === 0) { // non-null behavior unknown. Should be handled by logPoints team
                throw new Error('Enumerating processes failed.');
            }
            // Show a quick pick list (even if there is only 1 process)
            const quickPickItems = result.json.data.map((process) => {
                return {
                    label: `${process.pid}`,
                    description: ` ${process.command} `
                        + ` ${typeof process.arguments === 'string' ? process.arguments : process.arguments.join(' ')}`,
                    data: process.pid
                };
            });
            const quickPickOption = { placeHolder: `Please select a Node.js process to attach to: (${this.stepProgressText})` };
            let pickedProcess;
            try {
                pickedProcess = yield this.showQuickPick(quickPickItems, quickPickOption);
            }
            catch (e) {
                if (e instanceof vscode_azureextensionui_1.UserCancelledError) {
                    vscode.window.showInformationMessage('Please select a node process to debug.');
                }
                throw e;
            }
            this._wizard.processId = pickedProcess.data;
            this._wizard.writeline(`Selected process ${this._wizard.processId}. "${pickedProcess.description}"`);
        });
    }
}
exports.PickProcessStep = PickProcessStep;
//# sourceMappingURL=PickProcessStep.js.map