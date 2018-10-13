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
const constants_1 = require("../../constants");
class EligibilityCheck extends wizard_1.WizardStep {
    constructor(_wizard) {
        super(_wizard, 'Decide the app service eligibility for logpoints.');
        this._wizard = _wizard;
    }
    prompt() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!/(^|,)linux($|,)/.test(this._wizard.client.kind)) {
                throw new Error('Only Linux App Services are supported');
            }
            const config = yield this._wizard.client.getSiteConfig();
            const linuxFxVersion = config.linuxFxVersion;
            if (!linuxFxVersion) {
                throw new Error('Cannot read "linuxFxVersion"');
            }
            const [framework, fullImageName] = linuxFxVersion.split('|');
            // Remove the 'tag' portion of the image name.
            const imageName = fullImageName.split(':')[0];
            const enabledImages = vscode.workspace.getConfiguration(constants_1.extensionPrefix).get('enabledDockerImages') || [];
            const enabledImagesTagless = enabledImages.map((name) => {
                return name.split(':')[0].toLocaleLowerCase();
            });
            if ('docker' !== framework.toLocaleLowerCase() || enabledImagesTagless.indexOf(imageName.toLocaleLowerCase()) === -1) {
                throw new Error(`Please use one of the supported docker image. ${imageName} is not supported for starting a Logpoints session. More details can be found here - https://aka.ms/logpoints`);
            }
        });
    }
}
exports.EligibilityCheck = EligibilityCheck;
//# sourceMappingURL=EligibilityCheck.js.map