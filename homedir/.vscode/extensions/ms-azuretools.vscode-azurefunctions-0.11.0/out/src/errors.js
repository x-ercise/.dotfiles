"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const localize_1 = require("./localize");
// tslint:disable:max-classes-per-file
class NoWorkspaceError extends Error {
    constructor() {
        super(...arguments);
        this.message = localize_1.localize('azFunc.noWorkspaceError', 'You must have a workspace open to perform this operation.');
    }
}
exports.NoWorkspaceError = NoWorkspaceError;
class ArgumentError extends Error {
    constructor(obj) {
        super(localize_1.localize('azFunc.argumentError', 'Invalid {0}.', obj.constructor.name));
    }
}
exports.ArgumentError = ArgumentError;
class NoSubscriptionError extends Error {
    constructor() {
        super(...arguments);
        this.message = localize_1.localize('azFunc.noSubscriptionError', 'You must be signed in to Azure to perform this operation.');
    }
}
exports.NoSubscriptionError = NoSubscriptionError;
//# sourceMappingURL=errors.js.map