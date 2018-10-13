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
const requestP = require("request-promise");
const util_1 = require("util");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const requestPromise = requestP;
const initialPollingIntervalMs = 5000;
const pollingIncrementMs = 0; // Increase in interval each time
const maximumValidationMs = 60 * 1000;
const cancellations = new Map();
function cancelWebsiteValidation(siteTreeItem) {
    const cancellation = cancellations.get(siteTreeItem.id);
    if (cancellation) {
        cancellations.delete(siteTreeItem.id);
        cancellation.canceled = true;
    }
}
exports.cancelWebsiteValidation = cancelWebsiteValidation;
function validateWebSite(deploymentCorrelationId, siteTreeItem) {
    return __awaiter(this, void 0, void 0, function* () {
        cancelWebsiteValidation(siteTreeItem);
        const id = siteTreeItem.id;
        const cancellation = { canceled: false };
        cancellations.set(id, cancellation);
        return vscode_azureextensionui_1.callWithTelemetryAndErrorHandling('appService.validateWebSite', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.rethrowError = false;
                this.suppressErrorDisplay = true;
                const properties = this.properties;
                properties.correlationId = deploymentCorrelationId;
                let pollingIntervalMs = initialPollingIntervalMs;
                const start = Date.now();
                const uri = siteTreeItem.client.defaultHostUrl;
                const options = {
                    method: 'GET',
                    uri: uri,
                    resolveWithFullResponse: true
                };
                let currentStatusCode = 0;
                const statusCodes = [];
                // tslint:disable-next-line:no-constant-condition
                while (true) {
                    try {
                        const response = (yield requestPromise(options));
                        currentStatusCode = response.statusCode;
                    }
                    catch (error) {
                        // tslint:disable-next-line:strict-boolean-expressions
                        const response = error.response || {};
                        currentStatusCode = util_1.isNumber(response.statusCode) ? response.statusCode : 0;
                    }
                    if (cancellation.canceled) {
                        properties.canceled = 'true';
                        break;
                    }
                    const elapsedSeconds = Math.round((Date.now() - start) / 1000);
                    statusCodes.push({ code: currentStatusCode, elapsed: elapsedSeconds });
                    if (Date.now() > start + maximumValidationMs) {
                        break;
                    }
                    yield delay(pollingIntervalMs);
                    pollingIntervalMs += pollingIncrementMs;
                }
                properties.statusCodes = JSON.stringify(statusCodes);
                if (cancellations.get(id) === cancellation) {
                    cancellations.delete(id);
                }
            });
        });
    });
}
exports.validateWebSite = validateWebSite;
function delay(delayMs) {
    return __awaiter(this, void 0, void 0, function* () {
        yield new Promise((resolve) => { setTimeout(resolve, delayMs); });
    });
}
//# sourceMappingURL=validateWebSite.js.map