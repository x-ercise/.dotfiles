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
const request = require("request");
const wizard_1 = require("../../wizard");
class ActivateSite extends wizard_1.WizardStep {
    constructor(_wizard) {
        super(_wizard, 'Send an activation ping to the site root URL.');
        this._wizard = _wizard;
    }
    prompt() {
        return __awaiter(this, void 0, void 0, function* () {
            const site = this._wizard.selectedDeploymentSlot;
            if (!site) {
                throw new Error("There is no pre-selected deployment slot or site.");
            }
            const siteRootUrl = this.getSiteRootUrl(site);
            // Intentionally ignore the response.
            request(siteRootUrl);
        });
    }
    getSiteRootUrl(site) {
        // tslint:disable-next-line:no-http-string
        return `http://${site.defaultHostName}`;
    }
}
exports.ActivateSite = ActivateSite;
//# sourceMappingURL=ActivateSite.js.map