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
const constants_1 = require("../constants");
const localize_1 = require("../localize");
const npmRegistryUri = 'https://aka.ms/W2mvv3';
function getNpmDistTag(runtime) {
    return __awaiter(this, void 0, void 0, function* () {
        const tags = JSON.parse(yield request(npmRegistryUri));
        for (const key of Object.keys(tags)) {
            if ((runtime === constants_1.ProjectRuntime.v1 && tags[key].startsWith('1')) ||
                (runtime === constants_1.ProjectRuntime.v2 && tags[key].startsWith('2'))) {
                return { tag: key, value: tags[key] };
            }
        }
        throw new Error(localize_1.localize('noDistTag', 'Failed to retrieve NPM tag for runtime "{0}".', runtime));
    });
}
exports.getNpmDistTag = getNpmDistTag;
//# sourceMappingURL=getNpmDistTag.js.map