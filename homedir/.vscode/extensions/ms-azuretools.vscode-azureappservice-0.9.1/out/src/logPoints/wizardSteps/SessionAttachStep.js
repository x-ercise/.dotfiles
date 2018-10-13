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
const logpointsUtil_1 = require("../../utils/logpointsUtil");
const wizard_1 = require("../../wizard");
class SessionAttachStep extends wizard_1.WizardStep {
    constructor(_wizard, _logPointsDebuggerClient) {
        super(_wizard, 'Attach to node process.');
        this._wizard = _wizard;
        this._logPointsDebuggerClient = _logPointsDebuggerClient;
    }
    execute() {
        return __awaiter(this, void 0, void 0, function* () {
            const selectedSlot = this.wizard.selectedDeploymentSlot; // non-null behavior unknown. Should be handled by logPoints team
            const instance = this._wizard.selectedInstance;
            const publishCredential = yield this._wizard.getCachedCredentialOrRefetch(selectedSlot);
            const requestData = { sessionId: this._wizard.sessionId, processId: this._wizard.processId };
            let result = yield vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, (p) => __awaiter(this, void 0, void 0, function* () {
                const message = `Attach debugging to session ${this._wizard.sessionId}...`;
                p.report({ message: message });
                this._wizard.writeline(message);
                return yield logpointsUtil_1.callWithTimeout(() => {
                    return this._logPointsDebuggerClient.attachProcess(selectedSlot.fullName, instance.name, publishCredential, requestData); // non-null behavior unknown. Should be handled by logPoints team
                }, logpointsUtil_1.DEFAULT_TIMEOUT);
            }));
            if (result.isSuccessful()) {
                this._wizard.debuggerId = result.json.data.debugeeId; // non-null behavior unknown. Should be handled by logPoints team
                this._wizard.writeline(`Attached to process ${this._wizard.processId}, got debugId ${this._wizard.debuggerId}`);
            }
            else {
                throw new Error(`Attached to process ${this._wizard.processId} failed, got response ${result.json.error.message}`); // non-null behavior unknown. Should be handled by logPoints team
            }
        });
    }
}
exports.SessionAttachStep = SessionAttachStep;
//# sourceMappingURL=SessionAttachStep.js.map