"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util = require("util");
const vscode = require("vscode");
// tslint:disable:align
class LogpointsCollection {
    constructor(_documentUri) {
        this._documentUri = _documentUri;
        this.clearRegistry();
    }
    get documentUri() {
        return this._documentUri;
    }
    getLogpointForLine(line) {
        return this._logpointRegistry[line];
    }
    registerLogpoint(tracepoint) {
        if (this.getLogpointForLine(tracepoint.line)) {
            vscode.window.showInformationMessage(util.format("There is already a tracepoint at line %d, setting a new tracepoint will overwrite that."));
        }
        this._logpointRegistry[tracepoint.line] = tracepoint;
    }
    unregisterLogpoint(tracepoint) {
        if (this._logpointRegistry[tracepoint.line]) {
            delete this._logpointRegistry[tracepoint.line];
        }
        else {
            throw new Error(util.format("Cannot find a tracepoint at line %d to delete in %s. It has not been recorded.", tracepoint.line, this._documentUri.fsPath));
        }
    }
    getLogpoints() {
        // tslint:disable-next-line:no-any
        return Object.values(this._logpointRegistry);
    }
    clearRegistry() {
        this._logpointRegistry = {};
    }
    updateTextEditorDecroration() {
        if (!vscode.window.activeTextEditor) {
            return;
        }
        if (this._documentUri.toString() !== vscode.window.activeTextEditor.document.uri.toString()) {
            // Cannot control non-active editor, no-op.
            return;
        }
        if (!LogpointsCollection.TextEditorDecorationType) {
            // If LogpointsCollection.TextEditorDecorationType is not set, it means the extension is not ready yet.
            throw new Error('The extension initiation is expected to finish now.');
        }
        const ranges = [];
        const logpoints = this.getLogpoints();
        // Do this even if the `logpoints` is empty, then we clear all the existing decorations
        (logpoints || []).forEach((logpoint) => {
            const line = logpoint.line;
            ranges.push(new vscode.Range(line, 0, line, 0));
        });
        vscode.window.activeTextEditor.setDecorations(LogpointsCollection.TextEditorDecorationType, ranges);
    }
}
exports.LogpointsCollection = LogpointsCollection;
//# sourceMappingURL=LogpointsCollection.js.map