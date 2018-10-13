"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../../constants");
const localize_1 = require("../../localize");
const IProjectCreator_1 = require("./IProjectCreator");
const ScriptProjectCreatorBase_1 = require("./ScriptProjectCreatorBase");
exports.funcNodeDebugArgs = '--inspect=5858';
exports.funcNodeDebugEnvVar = 'languageWorkers:node:arguments';
class JavaScriptProjectCreator extends ScriptProjectCreatorBase_1.ScriptProjectCreatorBase {
    constructor() {
        super(...arguments);
        this.templateFilter = constants_1.TemplateFilter.Verified;
        this.deploySubpath = '.';
        this.functionsWorkerRuntime = 'node';
    }
    getLaunchJson() {
        return {
            version: '0.2.0',
            configurations: [
                {
                    name: localize_1.localize('azFunc.attachToJavaScriptFunc', 'Attach to JavaScript Functions'),
                    type: 'node',
                    request: 'attach',
                    port: 5858,
                    preLaunchTask: IProjectCreator_1.funcHostTaskId
                }
            ]
        };
    }
    getTasksJson(runtime) {
        let options;
        // tslint:disable-next-line:no-any
        const funcTask = {
            label: IProjectCreator_1.funcHostTaskLabel,
            identifier: IProjectCreator_1.funcHostTaskId,
            type: 'shell',
            command: 'func host start',
            isBackground: true,
            presentation: {
                reveal: 'always'
            },
            problemMatcher: IProjectCreator_1.funcWatchProblemMatcher
        };
        const installExtensionsTask = {
            label: constants_1.installExtensionsId,
            identifier: constants_1.installExtensionsId,
            command: 'func extensions install',
            type: 'shell',
            presentation: {
                reveal: 'always'
            }
        };
        // tslint:disable-next-line:no-unsafe-any
        const tasks = [funcTask];
        if (runtime !== constants_1.ProjectRuntime.v1) {
            options = {};
            options.env = {};
            options.env[exports.funcNodeDebugEnvVar] = exports.funcNodeDebugArgs;
            // tslint:disable-next-line:no-unsafe-any
            funcTask.options = options;
            // tslint:disable-next-line:no-unsafe-any
            funcTask.dependsOn = constants_1.installExtensionsId;
            this.preDeployTask = constants_1.installExtensionsId;
            tasks.push(installExtensionsTask);
        }
        return {
            version: '2.0.0',
            tasks: tasks
        };
    }
}
exports.JavaScriptProjectCreator = JavaScriptProjectCreator;
//# sourceMappingURL=JavaScriptProjectCreator.js.map