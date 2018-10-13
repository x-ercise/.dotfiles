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
const extract = require("extract-zip");
const fse = require("fs-extra");
const os = require("os");
const path = require("path");
const constants_1 = require("../constants");
const extensionVariables_1 = require("../extensionVariables");
const fs_1 = require("../utils/fs");
const parseScriptTemplates_1 = require("./parseScriptTemplates");
const TemplateRetriever_1 = require("./TemplateRetriever");
class ScriptTemplateRetriever extends TemplateRetriever_1.TemplateRetriever {
    constructor() {
        super(...arguments);
        this.templateType = TemplateRetriever_1.TemplateType.Script;
        this._templatesKey = 'FunctionTemplates';
        this._configKey = 'FunctionTemplateConfig';
        this._resourcesKey = 'FunctionTemplateResources';
    }
    getVerifiedTemplateIds(runtime) {
        return getScriptVerifiedTemplateIds(runtime);
    }
    getTemplatesFromCache(runtime) {
        return __awaiter(this, void 0, void 0, function* () {
            const cachedResources = extensionVariables_1.ext.context.globalState.get(this.getCacheKey(this._resourcesKey, runtime));
            const cachedTemplates = extensionVariables_1.ext.context.globalState.get(this.getCacheKey(this._templatesKey, runtime));
            const cachedConfig = extensionVariables_1.ext.context.globalState.get(this.getCacheKey(this._configKey, runtime));
            if (cachedResources && cachedTemplates && cachedConfig) {
                return parseScriptTemplates_1.parseScriptTemplates(cachedResources, cachedTemplates, cachedConfig);
            }
            else {
                return undefined;
            }
        });
    }
    getTemplatesFromCliFeed(cliFeedJson, templateVersion, _runtime) {
        return __awaiter(this, void 0, void 0, function* () {
            const templatesPath = path.join(os.tmpdir(), 'vscode-azurefunctions-templates');
            try {
                const filePath = path.join(templatesPath, `templates-${templateVersion}.zip`);
                yield fs_1.downloadFile(cliFeedJson.releases[templateVersion].templateApiZip, filePath);
                yield new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                    // tslint:disable-next-line:no-unsafe-any
                    extract(filePath, { dir: templatesPath }, (err) => {
                        // tslint:disable-next-line:strict-boolean-expressions
                        if (err) {
                            reject(err);
                        }
                        resolve();
                    });
                }));
                return yield this.parseTemplates(templatesPath);
            }
            finally {
                if (yield fse.pathExists(templatesPath)) {
                    yield fse.remove(templatesPath);
                }
            }
        });
    }
    getTemplatesFromBackup(runtime) {
        return __awaiter(this, void 0, void 0, function* () {
            const backupTemplatesPath = extensionVariables_1.ext.context.asAbsolutePath(path.join('resources', 'backupScriptTemplates', runtime));
            return yield this.parseTemplates(backupTemplatesPath);
        });
    }
    cacheTemplates(runtime) {
        return __awaiter(this, void 0, void 0, function* () {
            extensionVariables_1.ext.context.globalState.update(this.getCacheKey(this._templatesKey, runtime), this._rawTemplates);
            extensionVariables_1.ext.context.globalState.update(this.getCacheKey(this._configKey, runtime), this._rawConfig);
            extensionVariables_1.ext.context.globalState.update(this.getCacheKey(this._resourcesKey, runtime), this._rawResources);
        });
    }
    parseTemplates(templatesPath) {
        return __awaiter(this, void 0, void 0, function* () {
            // only Resources.json has a capital letter
            this._rawResources = (yield fse.readJSON(path.join(templatesPath, 'resources', 'Resources.json')));
            this._rawTemplates = (yield fse.readJSON(path.join(templatesPath, 'templates', 'templates.json')));
            this._rawConfig = (yield fse.readJSON(path.join(templatesPath, 'bindings', 'bindings.json')));
            return parseScriptTemplates_1.parseScriptTemplates(this._rawResources, this._rawTemplates, this._rawConfig);
        });
    }
}
exports.ScriptTemplateRetriever = ScriptTemplateRetriever;
function getScriptVerifiedTemplateIds(runtime) {
    let verifiedTemplateIds = [
        'BlobTrigger-JavaScript',
        'HttpTrigger-JavaScript',
        'QueueTrigger-JavaScript',
        'TimerTrigger-JavaScript'
    ];
    if (runtime === constants_1.ProjectRuntime.v1) {
        verifiedTemplateIds = verifiedTemplateIds.concat([
            'GenericWebHook-JavaScript',
            'GitHubWebHook-JavaScript',
            'HttpTriggerWithParameters-JavaScript',
            'ManualTrigger-JavaScript'
        ]);
    }
    else {
        // Python is only supported in v2
        // For JavaScript, only include triggers that require extensions in v2. v1 doesn't have the same support for 'func extensions install'
        verifiedTemplateIds = verifiedTemplateIds.concat([
            'CosmosDBTrigger-JavaScript',
            'ServiceBusQueueTrigger-JavaScript',
            'ServiceBusTopicTrigger-JavaScript',
            'BlobTrigger-Python',
            'HttpTrigger-Python',
            'QueueTrigger-Python',
            'TimerTrigger-Python',
            'CosmosDBTrigger-Python',
            'ServiceBusQueueTrigger-Python',
            'ServiceBusTopicTrigger-Python'
        ]);
    }
    return verifiedTemplateIds;
}
exports.getScriptVerifiedTemplateIds = getScriptVerifiedTemplateIds;
//# sourceMappingURL=ScriptTemplateRetriever.js.map