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
class GetUnoccupiedInstance extends wizard_1.WizardStep {
    constructor(_wizard, _logPointsDebuggerClient) {
        super(_wizard, 'Find the first available unoccupied instance.');
        this._wizard = _wizard;
        this._logPointsDebuggerClient = _logPointsDebuggerClient;
    }
    prompt() {
        return __awaiter(this, void 0, void 0, function* () {
            const selectedSlot = this.wizard.selectedDeploymentSlot; // non-null behavior unknown. Should be handled by logPoints team
            const publishCredential = yield this._wizard.getCachedCredentialOrRefetch(selectedSlot);
            let instances = yield vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, (p) => __awaiter(this, void 0, void 0, function* () {
                const message = `Enumerating instances of ${selectedSlot.fullName}...`;
                p.report({ message: message });
                this._wizard.writeline(message);
                const result = yield this._wizard.client.listInstanceIdentifiers();
                this._wizard.writeline(`Got ${result.length} instances.`);
                return result;
            }));
            instances = instances.sort((a, b) => {
                return a.name.localeCompare(b.name); // non-null behavior unknown. Should be handled by logPoints team
            });
            const startSessionRequest = { username: this._wizard.uiTreeItem.userId };
            for (const instance of instances) {
                let result;
                yield vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, (p) => __awaiter(this, void 0, void 0, function* () {
                    const message = `Trying to start a session from instance ${instance.name}...`;
                    p.report({ message: message });
                    this._wizard.writeline(message);
                    try {
                        result = yield logpointsUtil_1.callWithTimeout(() => {
                            return this._logPointsDebuggerClient.startSession(selectedSlot.fullName, instance.name, publishCredential, startSessionRequest); // non-null behavior unknown. Should be handled by logPoints team
                        }, logpointsUtil_1.DEFAULT_TIMEOUT);
                    }
                    catch (e) {
                        // If there is an error, mark the request failed by resetting `result`.
                        result = undefined;
                    }
                }));
                if (result && result.isSuccessful()) {
                    this._wizard.selectedInstance = instance;
                    this._wizard.sessionId = result.json.data.debuggingSessionId; // non-null behavior unknown. Should be handled by logPoints team
                    this._wizard.writeline(`Selected instance ${instance.name}`);
                    break;
                }
            }
            if (!this._wizard.selectedInstance) {
                const errorMessage = `There is no instance available to debug for ${selectedSlot.fullName}.`;
                vscode.window.showErrorMessage(errorMessage);
                throw new Error(errorMessage);
            }
        });
    }
}
exports.GetUnoccupiedInstance = GetUnoccupiedInstance;
//# sourceMappingURL=GetUnoccupiedInstance.js.map