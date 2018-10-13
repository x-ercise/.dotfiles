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
const wizard_1 = require("../../wizard");
class StartDebugAdapterStep extends wizard_1.WizardStep {
    constructor(_wizard) {
        super(_wizard, 'Start debug adapater.');
        this._wizard = _wizard;
    }
    execute() {
        return __awaiter(this, void 0, void 0, function* () {
            const client = this._wizard.selectedDeploymentSlot; // non-null behavior unknown. Should be handled by logPoints team
            const publishCredential = yield this._wizard.getCachedCredentialOrRefetch(client);
            // Assume the next started debug sessionw is the one we will launch next.
            const startEventHandler = vscode.debug.onDidStartDebugSession(() => {
                startEventHandler.dispose();
                vscode.commands.executeCommand('workbench.view.debug');
            });
            const folder = undefined; // For logpoints scenarios, workspace folder is always undefined
            yield vscode.debug.startDebugging(folder, {
                type: "jsLogpoints",
                name: client.fullName,
                request: "attach",
                trace: true,
                siteName: client.fullName,
                publishCredentialUsername: publishCredential.publishingUserName,
                publishCredentialPassword: publishCredential.publishingPassword,
                instanceId: this._wizard.selectedInstance.name,
                sessionId: this._wizard.sessionId,
                debugId: this._wizard.debuggerId
            });
            this._wizard.writeline("Debug session started.");
        });
    }
}
exports.StartDebugAdapterStep = StartDebugAdapterStep;
//# sourceMappingURL=StartDebugAdapterStep.js.map