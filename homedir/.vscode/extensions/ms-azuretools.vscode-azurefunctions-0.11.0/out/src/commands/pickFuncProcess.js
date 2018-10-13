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
const extensionVariables_1 = require("vscode-azureappservice/lib/extensionVariables");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const constants_1 = require("../constants");
const validateFuncCoreToolsInstalled_1 = require("../funcCoreTools/validateFuncCoreToolsInstalled");
const localize_1 = require("../localize");
const ProjectSettings_1 = require("../ProjectSettings");
const tryFetchNodeModule_1 = require("../utils/tryFetchNodeModule");
const IProjectCreator_1 = require("./createNewProject/IProjectCreator");
let isFuncTaskRunning = false;
function initPickFuncProcess() {
    extensionVariables_1.ext.context.subscriptions.push(vscode.tasks.onDidEndTask((e) => {
        if (isFuncTask(e.execution.task)) {
            isFuncTaskRunning = false;
        }
    }));
    extensionVariables_1.ext.context.subscriptions.push(vscode.tasks.onDidStartTask((e) => {
        if (isFuncTask(e.execution.task)) {
            isFuncTaskRunning = true;
        }
    }));
}
exports.initPickFuncProcess = initPickFuncProcess;
function pickFuncProcess(actionContext) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(yield validateFuncCoreToolsInstalled_1.validateFuncCoreToolsInstalled(true /* forcePrompt */))) {
            throw new vscode_azureextensionui_1.UserCancelledError();
        }
        // Stop any running func task so that a build can access those dlls
        yield stopFuncTaskIfRunning();
        const tasks = yield vscode.tasks.fetchTasks();
        const funcTask = tasks.find(isFuncTask);
        if (!funcTask) {
            throw new Error(localize_1.localize('noFuncTask', 'Failed to find task with label "{0}".', IProjectCreator_1.funcHostTaskLabel));
        }
        const settingKey = 'pickProcessTimeout';
        const settingValue = ProjectSettings_1.getFuncExtensionSetting(settingKey);
        const timeoutInSeconds = Number(settingValue);
        if (isNaN(timeoutInSeconds)) {
            throw new Error(localize_1.localize('invalidSettingValue', 'The setting "{0}" must be a number, but instead found "{1}".', settingKey, settingValue));
        }
        actionContext.properties.timeoutInSeconds = timeoutInSeconds.toString();
        const timeoutError = new Error(localize_1.localize('failedToFindFuncHost', 'Failed to detect running Functions host within "{0}" seconds. You may want to adjust the "{1}" setting.', timeoutInSeconds, `${constants_1.extensionPrefix}.${settingKey}`));
        const pid = yield startFuncTask(funcTask, timeoutInSeconds, timeoutError);
        // On Mac/Linux we can leverage the pid of the task directly.
        // On Windows, the pid of the task corresponds to the parent PowerShell process and we have to drill down to get the actual func process
        return constants_1.isWindows ? yield getInnermostWindowsPid(pid, timeoutInSeconds, timeoutError) : pid;
    });
}
exports.pickFuncProcess = pickFuncProcess;
function isFuncTask(task) {
    // Until this is fixed, we have to query the task's name instead of id: https://github.com/Microsoft/vscode/issues/57707
    return task.name.toLowerCase() === IProjectCreator_1.funcHostTaskLabel.toLowerCase();
}
function stopFuncTaskIfRunning() {
    return __awaiter(this, void 0, void 0, function* () {
        const funcExecution = vscode.tasks.taskExecutions.find((te) => isFuncTask(te.task));
        if (funcExecution && isFuncTaskRunning) {
            const waitForEndPromise = new Promise((resolve, reject) => {
                const listener = vscode.tasks.onDidEndTask((e) => {
                    if (isFuncTask(e.execution.task)) {
                        resolve();
                        listener.dispose();
                    }
                });
                const timeoutInSeconds = 30;
                const timeoutError = new Error(localize_1.localize('failedToFindFuncHost', 'Failed to stop previous running Functions host within "{0}" seconds. Make sure the task has stopped before you debug again.', timeoutInSeconds));
                setTimeout(() => { reject(timeoutError); }, timeoutInSeconds * 1000);
            });
            funcExecution.terminate();
            yield waitForEndPromise;
        }
    });
}
function startFuncTask(funcTask, timeoutInSeconds, timeoutError) {
    return __awaiter(this, void 0, void 0, function* () {
        const waitForStartPromise = new Promise((resolve, reject) => {
            const listener = vscode.tasks.onDidStartTaskProcess((e) => {
                if (isFuncTask(e.execution.task)) {
                    resolve(e.processId.toString());
                    listener.dispose();
                }
            });
            const errorListener = vscode.tasks.onDidEndTaskProcess((e) => {
                if (e.exitCode !== 0) {
                    // Throw if _any_ task fails, not just funcTask (since funcTask often depends on build/clean tasks)
                    reject(new Error(localize_1.localize('taskFailed', 'Failed to start debugging. Task "{0}" failed with exit code "{1}".', e.execution.task.name, e.exitCode)));
                    errorListener.dispose();
                }
            });
            setTimeout(() => { reject(timeoutError); }, timeoutInSeconds * 1000);
        });
        yield vscode.tasks.executeTask(funcTask);
        return yield waitForStartPromise;
    });
}
function getInnermostWindowsPid(pid, timeoutInSeconds, timeoutError) {
    return __awaiter(this, void 0, void 0, function* () {
        const moduleName = 'windows-process-tree';
        const windowsProcessTree = yield tryFetchNodeModule_1.tryFetchNodeModule(moduleName);
        if (!windowsProcessTree) {
            throw new Error(localize_1.localize('noWindowsProcessTree', 'Failed to find dependency "{0}".', moduleName));
        }
        const maxTime = Date.now() + timeoutInSeconds * 1000;
        while (Date.now() < maxTime) {
            let psTree = yield new Promise((resolve) => {
                windowsProcessTree.getProcessTree(Number(pid), resolve);
            });
            if (!psTree) {
                throw new Error(localize_1.localize('funcTaskStopped', 'Functions host is no longer running.'));
            }
            while (psTree.children.length > 0) {
                psTree = psTree.children[0];
            }
            if (psTree.name.toLowerCase().includes('func')) {
                return psTree.pid.toString();
            }
            else {
                yield delay(500);
            }
        }
        throw timeoutError;
    });
}
function delay(ms) {
    return __awaiter(this, void 0, void 0, function* () {
        yield new Promise((resolve) => setTimeout(resolve, ms));
    });
}
//# sourceMappingURL=pickFuncProcess.js.map