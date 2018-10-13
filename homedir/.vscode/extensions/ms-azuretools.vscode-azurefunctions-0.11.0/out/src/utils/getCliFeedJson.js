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
// tslint:disable-next-line:no-require-imports
const request = require("request-promise");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const constants_1 = require("../constants");
const localize_1 = require("../localize");
const funcCliFeedUrl = 'https://aka.ms/V00v5v';
const v1DefaultNodeVersion = '6.5.0';
const v2DefaultNodeVersion = '8.11.1';
function tryGetCliFeedJson() {
    return __awaiter(this, void 0, void 0, function* () {
        // tslint:disable-next-line:no-unsafe-any
        return yield vscode_azureextensionui_1.callWithTelemetryAndErrorHandling('azureFunctions.tryGetCliFeedJson', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.properties.isActivationEvent = 'true';
                this.suppressErrorDisplay = true;
                const funcJsonOptions = {
                    method: 'GET',
                    uri: funcCliFeedUrl
                };
                return JSON.parse(yield request(funcJsonOptions).promise());
            });
        });
    });
}
exports.tryGetCliFeedJson = tryGetCliFeedJson;
function getFeedRuntime(runtime) {
    switch (runtime) {
        case constants_1.ProjectRuntime.v2:
            return 'v2';
        case constants_1.ProjectRuntime.v1:
            return 'v1';
        default:
            throw new RangeError(localize_1.localize('invalidRuntime', 'Invalid runtime "{0}".', runtime));
    }
}
exports.getFeedRuntime = getFeedRuntime;
/**
 * Returns the app settings that should be used when creating or deploying to a Function App, based on runtime
 */
function getCliFeedAppSettings(projectRuntime) {
    return __awaiter(this, void 0, void 0, function* () {
        // Use these defaults in case we can't get the cli-feed
        let funcVersion = projectRuntime;
        let nodeVersion = projectRuntime === constants_1.ProjectRuntime.v1 ? v1DefaultNodeVersion : v2DefaultNodeVersion;
        const cliFeed = yield tryGetCliFeedJson();
        if (cliFeed) {
            const release = cliFeed.tags[getFeedRuntime(projectRuntime)].release;
            funcVersion = cliFeed.releases[release].FUNCTIONS_EXTENSION_VERSION;
            nodeVersion = cliFeed.releases[release].nodeVersion;
        }
        return {
            FUNCTIONS_EXTENSION_VERSION: funcVersion,
            WEBSITE_NODE_DEFAULT_VERSION: nodeVersion
        };
    });
}
exports.getCliFeedAppSettings = getCliFeedAppSettings;
//# sourceMappingURL=getCliFeedJson.js.map