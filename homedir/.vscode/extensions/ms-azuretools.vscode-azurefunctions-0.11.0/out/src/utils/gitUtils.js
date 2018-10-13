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
const cpUtils_1 = require("./cpUtils");
var gitUtils;
(function (gitUtils) {
    const gitCommand = 'git';
    function isGitInstalled(workingDirectory) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield cpUtils_1.cpUtils.executeCommand(undefined, workingDirectory, gitCommand, '--version');
                return true;
            }
            catch (error) {
                return false;
            }
        });
    }
    gitUtils.isGitInstalled = isGitInstalled;
    function gitInit(outputChannel, workingDirectory) {
        return __awaiter(this, void 0, void 0, function* () {
            yield cpUtils_1.cpUtils.executeCommand(outputChannel, workingDirectory, gitCommand, 'init');
        });
    }
    gitUtils.gitInit = gitInit;
    function isInsideRepo(workingDirectory) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield cpUtils_1.cpUtils.executeCommand(undefined, workingDirectory, gitCommand, 'rev-parse', '--git-dir');
                return true;
            }
            catch (error) {
                return false;
            }
        });
    }
    gitUtils.isInsideRepo = isInsideRepo;
})(gitUtils = exports.gitUtils || (exports.gitUtils = {}));
//# sourceMappingURL=gitUtils.js.map