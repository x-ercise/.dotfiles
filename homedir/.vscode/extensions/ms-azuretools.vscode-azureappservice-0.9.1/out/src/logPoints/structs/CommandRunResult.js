"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
class CommandRunResult {
    constructor(error, exitCode, output) {
        this.error = error;
        this.exitCode = exitCode;
        this.output = output;
        this.parseStdOut();
    }
    isSuccessful() {
        return !!(this.exitCode === 0 && this.json && !this.json.error);
    }
    get json() {
        if (this._json === undefined) {
            try {
                this._json = this._stdout ? JSON.parse(this._stdout) : undefined;
            }
            catch (err) {
                this._json = undefined;
            }
        }
        return this._json;
    }
    parseStdOut() {
        try {
            const outputJson = JSON.parse(this.output);
            this._stdout = outputJson.stdout;
            if (!this.error) {
                this.error = outputJson.stderr;
            }
        }
        catch (err) {
            this._stdout = undefined;
        }
    }
}
exports.CommandRunResult = CommandRunResult;
//# sourceMappingURL=CommandRunResult.js.map