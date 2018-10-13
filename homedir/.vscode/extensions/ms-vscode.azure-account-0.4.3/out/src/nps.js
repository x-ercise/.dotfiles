/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const nls = require("vscode-nls");
const opn = require("opn");
const localize = nls.loadMessageBundle();
const NPS_SURVEY_URL = 'https://www.surveymonkey.com/r/SMQM3DH';
const PROBABILITY = 0.15;
const SESSION_COUNT_KEY = 'nps/sessionCount';
const LAST_SESSION_DATE_KEY = 'nps/lastSessionDate';
const SKIP_VERSION_KEY = 'nps/skipVersion';
const IS_CANDIDATE_KEY = 'nps/isCandidate';
function survey({ globalState }, reporter) {
    (() => __awaiter(this, void 0, void 0, function* () {
        if (vscode_1.env.language !== 'en' && !vscode_1.env.language.startsWith('en-')) {
            return;
        }
        const skipVersion = globalState.get(SKIP_VERSION_KEY, '');
        if (skipVersion) {
            return;
        }
        const date = new Date().toDateString();
        const lastSessionDate = globalState.get(LAST_SESSION_DATE_KEY, new Date(0).toDateString());
        if (date === lastSessionDate) {
            return;
        }
        const sessionCount = globalState.get(SESSION_COUNT_KEY, 0) + 1;
        yield globalState.update(LAST_SESSION_DATE_KEY, date);
        yield globalState.update(SESSION_COUNT_KEY, sessionCount);
        if (sessionCount < 9) {
            return;
        }
        const isCandidate = globalState.get(IS_CANDIDATE_KEY, false)
            || Math.random() < PROBABILITY;
        yield globalState.update(IS_CANDIDATE_KEY, isCandidate);
        const extensionVersion = vscode_1.extensions.getExtension('ms-vscode.azure-account').packageJSON.version || 'unknown';
        if (!isCandidate) {
            yield globalState.update(SKIP_VERSION_KEY, extensionVersion);
            return;
        }
        const take = {
            title: localize('azure-account.takeSurvey', "Take Survey"),
            run: () => __awaiter(this, void 0, void 0, function* () {
                /* __GDPR__
                    "nps.survey/takeShortSurvey" : {}
                */
                reporter.sendTelemetryEvent('nps.survey/takeShortSurvey');
                opn(`${NPS_SURVEY_URL}?o=${encodeURIComponent(process.platform)}&v=${encodeURIComponent(extensionVersion)}&m=${encodeURIComponent(vscode_1.env.machineId)}`);
                yield globalState.update(IS_CANDIDATE_KEY, false);
                yield globalState.update(SKIP_VERSION_KEY, extensionVersion);
            })
        };
        const remind = {
            title: localize('azure-account.remindLater', "Remind Me Later"),
            run: () => __awaiter(this, void 0, void 0, function* () {
                /* __GDPR__
                    "nps.survey/remindMeLater" : {}
                */
                reporter.sendTelemetryEvent('nps.survey/remindMeLater');
                yield globalState.update(SESSION_COUNT_KEY, sessionCount - 3);
            })
        };
        const never = {
            title: localize('azure-account.neverAgain', "Don't Show Again"),
            isSecondary: true,
            run: () => __awaiter(this, void 0, void 0, function* () {
                /* __GDPR__
                    "nps.survey/dontShowAgain" : {}
                */
                reporter.sendTelemetryEvent('nps.survey/dontShowAgain');
                yield globalState.update(IS_CANDIDATE_KEY, false);
                yield globalState.update(SKIP_VERSION_KEY, extensionVersion);
            })
        };
        /* __GDPR__
            "nps.survey/userAsked" : {}
        */
        reporter.sendTelemetryEvent('nps.survey/userAsked');
        const button = yield vscode_1.window.showInformationMessage(localize('azure-account.surveyQuestion', "Do you mind taking a quick feedback survey about the Azure Extensions for VS Code?"), take, remind, never);
        yield (button || remind).run();
    }))().catch(console.error);
}
exports.survey = survey;
//# sourceMappingURL=nps.js.map