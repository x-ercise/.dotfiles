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
const extensionVariables_1 = require("../extensionVariables");
const cpUtils_1 = require("../utils/cpUtils");
function executeDotnetTemplateCommand(runtime, workingDirectory, operation, ...args) {
    return __awaiter(this, void 0, void 0, function* () {
        const jsonDllPath = extensionVariables_1.ext.context.asAbsolutePath(path.join('resources', 'dotnetJsonCli', 'Microsoft.TemplateEngine.JsonCli.dll'));
        return yield cpUtils_1.cpUtils.executeCommand(undefined, workingDirectory, 'dotnet', cpUtils_1.cpUtils.wrapArgInQuotes(jsonDllPath), '--require', cpUtils_1.cpUtils.wrapArgInQuotes(getDotnetItemTemplatePath(runtime)), '--require', cpUtils_1.cpUtils.wrapArgInQuotes(getDotnetProjectTemplatePath(runtime)), '--operation', operation, ...args);
    });
}
exports.executeDotnetTemplateCommand = executeDotnetTemplateCommand;
function getDotnetTemplatesPath() {
    return extensionVariables_1.ext.context.asAbsolutePath(path.join('resources', 'dotnetTemplates'));
}
exports.getDotnetTemplatesPath = getDotnetTemplatesPath;
function getDotnetItemTemplatePath(runtime) {
    return path.join(getDotnetTemplatesPath(), `itemTemplates-${runtime}.nupkg`);
}
exports.getDotnetItemTemplatePath = getDotnetItemTemplatePath;
function getDotnetProjectTemplatePath(runtime) {
    return path.join(getDotnetTemplatesPath(), `projectTemplates-${runtime}.nupkg`);
}
exports.getDotnetProjectTemplatePath = getDotnetProjectTemplatePath;
//# sourceMappingURL=executeDotnetTemplateCommand.js.map