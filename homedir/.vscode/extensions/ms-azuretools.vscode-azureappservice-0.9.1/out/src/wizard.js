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
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
class WizardBase {
    constructor(output) {
        this._steps = [];
        this.output = output;
    }
    write(text) {
        this.output.append(text);
    }
    writeline(text) {
        this.output.appendLine(text);
    }
    run(properties, promptOnly = false) {
        return __awaiter(this, void 0, void 0, function* () {
            this._telemetryProperties = properties;
            this.initSteps();
            // Go through the prompts...
            for (const step of this.steps) {
                try {
                    yield step.prompt();
                }
                catch (err) {
                    this.onError(err, step);
                }
            }
            if (promptOnly) {
                return {
                    status: 'PromptCompleted',
                    step: this.steps[this.steps.length - 1],
                    error: null
                };
            }
            return this.execute();
        });
    }
    execute() {
        return __awaiter(this, void 0, void 0, function* () {
            // Execute each step...
            this.output.show(true);
            for (let i = 0; i < this.steps.length; i++) {
                const step = this.steps[i];
                try {
                    this.beforeExecute(step, i);
                    yield this.steps[i].execute();
                }
                catch (err) {
                    this.onError(err, step);
                }
            }
            this._result = {
                status: 'Completed',
                step: this.steps[this.steps.length - 1],
                error: null
            };
            return this._result;
        });
    }
    get steps() {
        return this._steps;
    }
    findStepOfType(stepTypeConstructor, isOptional) {
        return this.findStep(step => step instanceof stepTypeConstructor, isOptional ? undefined : `The Wizard should have had a ${stepTypeConstructor.name} step`);
    }
    findStep(predicate, errorMessage) {
        const step = this.steps.find(predicate);
        if (!step && errorMessage) {
            throw new Error(errorMessage);
        }
        return step;
    }
    cancel(step) {
        this._telemetryProperties.stepTitle = step.telemetryStepTitle;
        this._telemetryProperties.stepIndex = step.stepIndex.toString();
        throw new vscode_azureextensionui_1.UserCancelledError();
    }
    onError(err, step) {
        this._telemetryProperties.stepTitle = step.telemetryStepTitle;
        this._telemetryProperties.stepIndex = step.stepIndex.toString();
        throw err;
    }
    beforeExecute(_step, _stepIndex) {
        return;
    }
}
exports.WizardBase = WizardBase;
class WizardStep {
    constructor(wizard, telemetryStepTitle, persistenceState) {
        this.wizard = wizard;
        this.telemetryStepTitle = telemetryStepTitle;
        this.persistenceState = persistenceState;
    }
    prompt() {
        return __awaiter(this, void 0, void 0, function* () {
            return;
        });
    }
    execute() {
        return __awaiter(this, void 0, void 0, function* () {
            return;
        });
    }
    get stepIndex() {
        return this.wizard.steps.findIndex(step => step === this);
    }
    get stepProgressText() {
        return `Step ${this.stepIndex + 1}/${this.wizard.steps.length}`;
    }
    showQuickPick(items, options, persistenceKey, token) {
        return __awaiter(this, void 0, void 0, function* () {
            options.ignoreFocusOut = true;
            let resolvedItems = yield items;
            if (this.persistenceState && persistenceKey) {
                // See if the previous value selected by the user is in this list, and move it to the top as default
                const previousId = this.persistenceState.get(persistenceKey);
                const previousItem = previousId && resolvedItems.find(item => item.persistenceId === previousId);
                if (previousItem) {
                    resolvedItems = ([previousItem]).concat(resolvedItems.filter(item => item !== previousItem));
                }
            }
            const result = yield vscode.window.showQuickPick(resolvedItems, options, token);
            if (!result) {
                throw new vscode_azureextensionui_1.UserCancelledError();
            }
            if (this.persistenceState && persistenceKey) {
                this.persistenceState.update(persistenceKey, result.persistenceId);
            }
            return result;
        });
    }
}
exports.WizardStep = WizardStep;
//# sourceMappingURL=wizard.js.map