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
/**
 * Used to fetch node modules shipped with VS Code that we don't want to ship with our extension (for example if they are OS-specific)
 */
function tryFetchNodeModule(moduleName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield Promise.resolve().then(() => require(`${vscode.env.appRoot}/node_modules.asar/${moduleName}`));
        }
        catch (err) {
            // ignore
        }
        try {
            return yield Promise.resolve().then(() => require(`${vscode.env.appRoot}/node_modules/${moduleName}`));
        }
        catch (err) {
            // ignore
        }
        return undefined;
    });
}
exports.tryFetchNodeModule = tryFetchNodeModule;
//# sourceMappingURL=tryFetchNodeModule.js.map