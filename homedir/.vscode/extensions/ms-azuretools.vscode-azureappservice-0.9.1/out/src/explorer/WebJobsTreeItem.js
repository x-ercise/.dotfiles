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
const vscode_azureappservice_1 = require("vscode-azureappservice");
class WebJobsTreeItem {
    constructor(client) {
        this.client = client;
        this.label = 'WebJobs';
        this.contextValue = WebJobsTreeItem.contextValue;
        this.childTypeLabel = 'Web Job';
    }
    get id() {
        return 'webJobs';
    }
    get iconPath() {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'WebJobs_color.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'WebJobs_color.svg')
        };
    }
    hasMoreChildren() {
        return false;
    }
    loadMoreChildren() {
        return __awaiter(this, void 0, void 0, function* () {
            const kuduClient = yield vscode_azureappservice_1.getKuduClient(this.client);
            const jobList = yield kuduClient.jobs.listAllJobs();
            return jobList.map((job) => {
                return { id: job.name, label: job.name, contextValue: 'webJob' };
            });
        });
    }
}
WebJobsTreeItem.contextValue = 'webJobs';
exports.WebJobsTreeItem = WebJobsTreeItem;
//# sourceMappingURL=WebJobsTreeItem.js.map