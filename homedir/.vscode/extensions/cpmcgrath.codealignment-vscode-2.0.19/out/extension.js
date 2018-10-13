'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const document_1 = require("./implementation/document");
const Alignment_1 = require("./common/business/Alignment");
const GeneralScopeSelector_1 = require("./common/business/selectors/GeneralScopeSelector");
const RegexDelimiterFinder_1 = require("./common/business/delimiterFinders/RegexDelimiterFinder");
const Options_1 = require("./common/business/Options");
function doAlignment(delimiter, useRegex = false, fromCaret = false) {
    let alignment = new Alignment_1.Alignment();
    alignment.View = new document_1.Document(vscode.window.activeTextEditor);
    let selector = new GeneralScopeSelector_1.GeneralScopeSelector();
    selector.ScopeSelectorRegex = new Options_1.Options().ScopeSelectorRegex;
    alignment.Selector = selector;
    if (useRegex)
        alignment.Finder = new RegexDelimiterFinder_1.RegexDelimiterFinder();
    let startIndex = 0;
    if (fromCaret) {
        let position = vscode.window.activeTextEditor.selection.active;
        startIndex = position.character;
    }
    alignment.PerformAlignment(delimiter, startIndex, false);
}
function AlignByString() {
    let options = {
        prompt: "Enter String to align: ",
        placeHolder: "(delimiter)",
    };
    vscode.window.showInputBox(options).then(value => {
        if (value)
            doAlignment(value);
    });
}
function AlignByRegex() {
    let options = {
        prompt: "Enter Regex to align: ",
        placeHolder: "(delimiter)",
    };
    vscode.window.showInputBox(options).then(value => {
        if (value)
            doAlignment(value, true);
    });
}
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    subscribeCommand(context, 'codealignment.alignbystring', AlignByString);
    subscribeCommand(context, 'codealignment.alignbyregex', AlignByRegex);
    subscribeCommand(context, 'codealignment.alignbyequals', () => doAlignment(' ='));
    subscribeCommand(context, 'codealignment.alignbyequalsfromcaret', () => doAlignment(' =', false, true));
    subscribeCommand(context, 'codealignment.alignbyperiod', () => doAlignment('.', false, true));
    subscribeCommand(context, 'codealignment.alignbyquote', () => doAlignment('"'));
    subscribeCommand(context, 'codealignment.alignbyquotefromcaret', () => doAlignment('"', false, true));
    subscribeCommand(context, 'codealignment.alignbyspace', () => doAlignment("\\s[^\\s]", true, true));
}
exports.activate = activate;
function subscribeCommand(context, key, callback) {
    context.subscriptions.push(vscode.commands.registerCommand(key, callback));
}
function deactivate() {
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map