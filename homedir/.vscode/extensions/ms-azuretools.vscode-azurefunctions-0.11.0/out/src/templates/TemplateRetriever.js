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
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const constants_1 = require("../constants");
const extensionVariables_1 = require("../extensionVariables");
const localize_1 = require("../localize");
const v2BackupTemplatesVersion = '2.3.3';
const v1BackupTemplatesVersion = '1.3.0';
var TemplateType;
(function (TemplateType) {
    TemplateType["Script"] = "Script";
    TemplateType["Dotnet"] = ".NET";
})(TemplateType = exports.TemplateType || (exports.TemplateType = {}));
class TemplateRetriever {
    tryGetTemplatesFromCache(context, runtime) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.getTemplatesFromCache(runtime);
            }
            catch (error) {
                const errorMessage = vscode_azureextensionui_1.parseError(error).message;
                extensionVariables_1.ext.outputChannel.appendLine(errorMessage);
                context.properties.cacheError = errorMessage;
                return undefined;
            }
        });
    }
    tryGetTemplatesFromCliFeed(context, cliFeedJson, templateVersion, runtime) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                context.properties.templateVersion = templateVersion;
                extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('updatingTemplates', 'Updating {0} templates for runtime "{1}" to version "{2}"...', this.templateType, runtime, templateVersion));
                const templates = yield this.getTemplatesFromCliFeed(cliFeedJson, templateVersion, runtime);
                yield this.verifyTemplates(templates, runtime);
                extensionVariables_1.ext.context.globalState.update(this.getCacheKey(TemplateRetriever.templateVersionKey, runtime), templateVersion);
                yield this.cacheTemplates(runtime);
                extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('updatedTemplates', 'Successfully updated templates.'));
                return templates;
            }
            catch (error) {
                const errorMessage = vscode_azureextensionui_1.parseError(error).message;
                extensionVariables_1.ext.outputChannel.appendLine(errorMessage);
                context.properties.cliFeedError = errorMessage;
                return undefined;
            }
        });
    }
    tryGetTemplatesFromBackup(context, runtime) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const backupTemplateVersion = this.getBackupVersion(runtime);
                const templates = yield this.getTemplatesFromBackup(runtime);
                yield this.verifyTemplates(templates, runtime);
                extensionVariables_1.ext.context.globalState.update(this.getCacheKey(TemplateRetriever.templateVersionKey, runtime), backupTemplateVersion);
                yield this.cacheTemplates(runtime);
                extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('usingBackupTemplates', 'Falling back to version "{0}" for {1} templates for runtime "{2}".', backupTemplateVersion, this.templateType, runtime));
                return templates;
            }
            catch (error) {
                const errorMessage = vscode_azureextensionui_1.parseError(error).message;
                extensionVariables_1.ext.outputChannel.appendLine(errorMessage);
                context.properties.backupError = errorMessage;
                return undefined;
            }
        });
    }
    /**
     * Adds runtime and templateType information to a key to ensure there are no collisions in the cache
     * For backwards compatability, the original runtime and templateType will not have this information
     */
    getCacheKey(key, runtime) {
        if (runtime !== constants_1.ProjectRuntime.v1) {
            key = `${key}.${runtime}`;
        }
        if (this.templateType !== TemplateType.Script) {
            key = `${key}.${this.templateType}`;
        }
        return key;
    }
    getBackupVersion(runtime) {
        switch (runtime) {
            case constants_1.ProjectRuntime.v1:
                return v1BackupTemplatesVersion;
            case constants_1.ProjectRuntime.v2:
                return v2BackupTemplatesVersion;
            default:
                throw new RangeError(localize_1.localize('invalidRuntime', 'Invalid runtime "{0}".', runtime));
        }
    }
    verifyTemplates(templates, runtime) {
        return __awaiter(this, void 0, void 0, function* () {
            const verifiedTemplateIds = this.getVerifiedTemplateIds(runtime);
            for (const verifiedTemplateId of verifiedTemplateIds) {
                if (!templates.some((t) => t.id === verifiedTemplateId)) {
                    throw new Error(localize_1.localize('failedToVerifiedTemplate', 'Failed to find verified template with id "{0}".', verifiedTemplateId));
                }
            }
        });
    }
}
TemplateRetriever.templateVersionKey = 'templateVersion';
exports.TemplateRetriever = TemplateRetriever;
//# sourceMappingURL=TemplateRetriever.js.map