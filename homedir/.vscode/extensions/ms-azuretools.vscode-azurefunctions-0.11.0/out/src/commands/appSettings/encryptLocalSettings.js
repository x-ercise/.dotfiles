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
const path = require("path");
const constants_1 = require("../../constants");
const extensionVariables_1 = require("../../extensionVariables");
const localize_1 = require("../../localize");
const cpUtils_1 = require("../../utils/cpUtils");
const workspaceUtil = require("../../utils/workspace");
function encryptLocalSettings(uri) {
    return __awaiter(this, void 0, void 0, function* () {
        const localSettingsPath = uri ? uri.fsPath : yield workspaceUtil.selectWorkspaceFile(extensionVariables_1.ext.ui, localize_1.localize('selectLocalSettings', 'Select the settings file to encrypt.'), () => constants_1.localSettingsFileName);
        extensionVariables_1.ext.outputChannel.show(true);
        yield cpUtils_1.cpUtils.executeCommand(extensionVariables_1.ext.outputChannel, path.dirname(localSettingsPath), 'func', 'settings', 'encrypt');
    });
}
exports.encryptLocalSettings = encryptLocalSettings;
//# sourceMappingURL=encryptLocalSettings.js.map