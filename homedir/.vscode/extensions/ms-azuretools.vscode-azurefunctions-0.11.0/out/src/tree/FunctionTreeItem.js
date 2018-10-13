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
const url_1 = require("url");
const vscode_azureappservice_1 = require("vscode-azureappservice");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const errors_1 = require("../errors");
const extensionVariables_1 = require("../extensionVariables");
const FunctionConfig_1 = require("../FunctionConfig");
const localize_1 = require("../localize");
const nodeUtils_1 = require("../utils/nodeUtils");
class FunctionTreeItem {
    constructor(client, func) {
        this.contextValue = FunctionTreeItem.contextValue;
        if (!func.id) {
            throw new errors_1.ArgumentError(func);
        }
        this.client = client;
        this._name = getFunctionNameFromId(func.id);
        this.config = new FunctionConfig_1.FunctionConfig(func.config);
    }
    get id() {
        return this._name;
    }
    get label() {
        return this.config.disabled ? localize_1.localize('azFunc.DisabledFunction', '{0} (Disabled)', this._name) : this._name;
    }
    get iconPath() {
        return nodeUtils_1.nodeUtils.getIconPath(FunctionTreeItem.contextValue);
    }
    get triggerUrl() {
        return this._triggerUrl;
    }
    get logStreamLabel() {
        return `${this.client.fullName}/${this._name}`;
    }
    get logStreamPath() {
        return `application/functions/function/${encodeURIComponent(this._name)}`;
    }
    deleteTreeItem(_node) {
        return __awaiter(this, void 0, void 0, function* () {
            const message = localize_1.localize('ConfirmDeleteFunction', 'Are you sure you want to delete function "{0}"?', this._name);
            yield extensionVariables_1.ext.ui.showWarningMessage(message, { modal: true }, vscode_azureextensionui_1.DialogResponses.deleteResponse, vscode_azureextensionui_1.DialogResponses.cancel);
            extensionVariables_1.ext.outputChannel.show(true);
            extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('DeletingFunction', 'Deleting function "{0}"...', this._name));
            yield this.client.deleteFunction(this._name);
            extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('DeleteFunctionSucceeded', 'Successfully deleted function "{0}".', this._name));
        });
    }
    initializeTriggerUrl() {
        return __awaiter(this, void 0, void 0, function* () {
            const triggerUrl = new url_1.URL(`${this.client.defaultHostUrl}/api/${this._name}`);
            const key = yield this.getKey();
            if (key) {
                triggerUrl.searchParams.set('code', key);
            }
            this._triggerUrl = triggerUrl.toString();
        });
    }
    getKey() {
        return __awaiter(this, void 0, void 0, function* () {
            let urlPath;
            switch (this.config.authLevel) {
                case FunctionConfig_1.HttpAuthLevel.admin:
                    urlPath = '/host/systemkeys/_master';
                    break;
                case FunctionConfig_1.HttpAuthLevel.function:
                    urlPath = `functions/${this._name}/keys/default`;
                    break;
                case FunctionConfig_1.HttpAuthLevel.anonymous:
                default:
                    return undefined;
            }
            const data = yield vscode_azureappservice_1.functionsAdminRequest(this.client, urlPath);
            try {
                // tslint:disable-next-line:no-unsafe-any
                const result = JSON.parse(data).value;
                if (result) {
                    return result;
                }
            }
            catch (_a) {
                // ignore json parse error and throw better error below
            }
            throw new Error(localize_1.localize('keyFail', 'Failed to get key for trigger "{0}".', this._name));
        });
    }
}
FunctionTreeItem.contextValue = 'azFuncFunction';
exports.FunctionTreeItem = FunctionTreeItem;
function getFunctionNameFromId(id) {
    const matches = id.match(/\/subscriptions\/(?:[^\/]+)\/resourceGroups\/(?:[^\/]+)\/providers\/Microsoft.Web\/sites\/(?:[^\/]+)\/functions\/([^\/]+)/);
    if (matches === null || matches.length < 2) {
        throw new Error(localize_1.localize('invalidFuncId', 'Invalid Functions Id'));
    }
    return matches[1];
}
exports.getFunctionNameFromId = getFunctionNameFromId;
//# sourceMappingURL=FunctionTreeItem.js.map