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
const fse = require("fs-extra");
// tslint:disable-next-line:no-require-imports
const opn = require("opn");
const vscode = require("vscode");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const xml2js = require("xml2js");
const localize_1 = require("../localize");
const cpUtils_1 = require("./cpUtils");
var mavenUtils;
(function (mavenUtils) {
    const mvnCommand = 'mvn';
    function validateMavenInstalled(actionContext, workingDirectory) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield cpUtils_1.cpUtils.executeCommand(undefined, workingDirectory, mvnCommand, '--version');
            }
            catch (error) {
                const message = localize_1.localize('azFunc.mvnNotFound', 'Failed to find "maven", please ensure that the maven bin directory is in your system path.');
                const result = yield vscode.window.showErrorMessage(message, vscode_azureextensionui_1.DialogResponses.learnMore, vscode_azureextensionui_1.DialogResponses.skipForNow);
                if (result === vscode_azureextensionui_1.DialogResponses.learnMore) {
                    yield opn('https://aka.ms/azurefunction_maven');
                }
                actionContext.suppressErrorDisplay = true; // Swallow errors in case show two error message
                throw new Error(localize_1.localize('azFunc.mvnNotFound', 'Failed to find "maven" on path.'));
            }
        });
    }
    mavenUtils.validateMavenInstalled = validateMavenInstalled;
    function getFunctionAppNameInPom(pomLocation) {
        return __awaiter(this, void 0, void 0, function* () {
            const pomString = yield fse.readFile(pomLocation, 'utf-8');
            return yield new Promise((resolve) => {
                // tslint:disable-next-line:no-any
                xml2js.parseString(pomString, { explicitArray: false }, (err, result) => {
                    if (result && !err) {
                        // tslint:disable-next-line:no-string-literal no-unsafe-any
                        if (result['project'] && result['project']['properties']) {
                            // tslint:disable-next-line:no-string-literal no-unsafe-any
                            resolve(result['project']['properties']['functionAppName']);
                            return;
                        }
                    }
                    resolve(undefined);
                });
            });
        });
    }
    mavenUtils.getFunctionAppNameInPom = getFunctionAppNameInPom;
    function executeMvnCommand(telemetryProperties, outputChannel, workingDirectory, ...args) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield cpUtils_1.cpUtils.tryExecuteCommand(outputChannel, workingDirectory, mvnCommand, ...args);
            if (result.code !== 0) {
                const mvnErrorRegexp = new RegExp(/^\[ERROR\](.*)$/, 'gm');
                const linesWithErrors = result.cmdOutputIncludingStderr.match(mvnErrorRegexp);
                let errorOutput = '';
                if (linesWithErrors !== null) {
                    for (const line of linesWithErrors) {
                        errorOutput += `${line.trim() ? line.trim() : ''}\n`;
                    }
                }
                errorOutput = errorOutput.replace(/^\[ERROR\]/gm, '');
                if (telemetryProperties) {
                    telemetryProperties.mavenErrors = errorOutput;
                }
                if (outputChannel) {
                    outputChannel.show();
                    throw new Error(localize_1.localize('azFunc.commandErrorWithOutput', 'Failed to run "{0}" command. Check output window for more details.', mvnCommand));
                }
            }
            else {
                if (outputChannel) {
                    outputChannel.appendLine(localize_1.localize('finishedRunningCommand', 'Finished running command: "{0} {1}".', mvnCommand, result.formattedArgs));
                }
            }
            return result.cmdOutput;
        });
    }
    mavenUtils.executeMvnCommand = executeMvnCommand;
    function formatMavenArg(key, value) {
        return `-${key}=${cpUtils_1.cpUtils.wrapArgInQuotes(value)}`;
    }
    mavenUtils.formatMavenArg = formatMavenArg;
})(mavenUtils = exports.mavenUtils || (exports.mavenUtils = {}));
//# sourceMappingURL=mavenUtils.js.map