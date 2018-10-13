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
const wizard_1 = require("../../wizard");
const vscode_azureappservice_1 = require("vscode-azureappservice");
class OpenStreamingLog extends wizard_1.WizardStep {
    constructor(_wizard) {
        super(_wizard, 'Detect logging stream availability.');
        this._wizard = _wizard;
    }
    prompt() {
        return __awaiter(this, void 0, void 0, function* () {
            const siteTreeItem = this._wizard.selectedDeploymentSlotTreeItem;
            if (!siteTreeItem) {
                throw new Error('Cannot locate a site to check logging stream availability.');
            }
            const verifyLoggingEnabled = () => __awaiter(this, void 0, void 0, function* () {
                const loggingEnabled = yield siteTreeItem.isHttpLogsEnabled();
                // Only proceed if logging is enabled.
                if (!loggingEnabled) {
                    vscode.window.showInformationMessage("Logpoints session require Streaming Log to start, which is not currently enabled. Please use \"View Streaming Log\" command to enable it.");
                    throw new vscode_azureextensionui_1.UserCancelledError("Streaming log is not enabled.");
                }
            });
            // Open streaming log
            const logStream = yield vscode_azureappservice_1.startStreamingLogs(siteTreeItem.client, verifyLoggingEnabled, siteTreeItem.logStreamLabel);
            this._wizard.logpointsManager.onStreamingLogOutputChannelCreated(siteTreeItem.client, logStream.outputChannel);
        });
    }
}
exports.OpenStreamingLog = OpenStreamingLog;
//# sourceMappingURL=OpenStreamingLog.js.map