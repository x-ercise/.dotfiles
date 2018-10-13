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
const path = require("path");
const constants_1 = require("../constants");
const extensionVariables_1 = require("../extensionVariables");
const localize_1 = require("../localize");
const dotnetUtils_1 = require("../utils/dotnetUtils");
const fs_1 = require("../utils/fs");
const executeDotnetTemplateCommand_1 = require("./executeDotnetTemplateCommand");
const parseDotnetTemplates_1 = require("./parseDotnetTemplates");
const TemplateRetriever_1 = require("./TemplateRetriever");
class DotnetTemplateRetriever extends TemplateRetriever_1.TemplateRetriever {
    constructor() {
        super(...arguments);
        this.templateType = TemplateRetriever_1.TemplateType.Dotnet;
        this._dotnetTemplatesKey = 'DotnetTemplates';
    }
    getVerifiedTemplateIds(runtime) {
        return getDotnetVerifiedTemplateIds(runtime);
    }
    getTemplatesFromCache(runtime) {
        return __awaiter(this, void 0, void 0, function* () {
            const projectFilePath = executeDotnetTemplateCommand_1.getDotnetProjectTemplatePath(runtime);
            const itemFilePath = executeDotnetTemplateCommand_1.getDotnetItemTemplatePath(runtime);
            if (!(yield fse.pathExists(projectFilePath)) || !(yield fse.pathExists(itemFilePath))) {
                return undefined;
            }
            const cachedDotnetTemplates = extensionVariables_1.ext.context.globalState.get(this.getCacheKey(this._dotnetTemplatesKey, runtime));
            if (cachedDotnetTemplates) {
                return parseDotnetTemplates_1.parseDotnetTemplates(cachedDotnetTemplates, runtime);
            }
            else {
                return undefined;
            }
        });
    }
    getTemplatesFromCliFeed(cliFeedJson, templateVersion, runtime) {
        return __awaiter(this, void 0, void 0, function* () {
            yield dotnetUtils_1.dotnetUtils.validateDotnetInstalled();
            const projectFilePath = executeDotnetTemplateCommand_1.getDotnetProjectTemplatePath(runtime);
            yield fs_1.downloadFile(cliFeedJson.releases[templateVersion].projectTemplates, projectFilePath);
            const itemFilePath = executeDotnetTemplateCommand_1.getDotnetItemTemplatePath(runtime);
            yield fs_1.downloadFile(cliFeedJson.releases[templateVersion].itemTemplates, itemFilePath);
            return yield this.parseTemplates(runtime);
        });
    }
    getTemplatesFromBackup(runtime) {
        return __awaiter(this, void 0, void 0, function* () {
            yield fse.copy(extensionVariables_1.ext.context.asAbsolutePath(path.join('resources', 'backupDotnetTemplates')), executeDotnetTemplateCommand_1.getDotnetTemplatesPath(), { overwrite: true, recursive: false });
            return yield this.parseTemplates(runtime);
        });
    }
    cacheTemplates(runtime) {
        return __awaiter(this, void 0, void 0, function* () {
            extensionVariables_1.ext.context.globalState.update(this.getCacheKey(this._dotnetTemplatesKey, runtime), this._rawTemplates);
        });
    }
    parseTemplates(runtime) {
        return __awaiter(this, void 0, void 0, function* () {
            this._rawTemplates = JSON.parse(yield executeDotnetTemplateCommand_1.executeDotnetTemplateCommand(runtime, undefined, 'list'));
            return parseDotnetTemplates_1.parseDotnetTemplates(this._rawTemplates, runtime);
        });
    }
}
exports.DotnetTemplateRetriever = DotnetTemplateRetriever;
function getDotnetVerifiedTemplateIds(runtime) {
    let verifiedTemplateIds = [
        'HttpTrigger',
        'BlobTrigger',
        'QueueTrigger',
        'TimerTrigger',
        'ServiceBusTopicTrigger',
        'ServiceBusQueueTrigger'
    ];
    if (runtime === constants_1.ProjectRuntime.v1) {
        verifiedTemplateIds = verifiedTemplateIds.concat([
            'GenericWebHook',
            'GitHubWebHook',
            'HttpTriggerWithParameters'
        ]);
    }
    return verifiedTemplateIds.map((id) => {
        id = `Azure.Function.CSharp.${id}`;
        switch (runtime) {
            case constants_1.ProjectRuntime.v1:
                return `${id}.1.x`;
            case constants_1.ProjectRuntime.v2:
                return `${id}.2.x`;
            default:
                throw new RangeError(localize_1.localize('invalidRuntime', 'Invalid runtime "{0}".', runtime));
        }
    });
}
exports.getDotnetVerifiedTemplateIds = getDotnetVerifiedTemplateIds;
//# sourceMappingURL=DotnetTemplateRetriever.js.map