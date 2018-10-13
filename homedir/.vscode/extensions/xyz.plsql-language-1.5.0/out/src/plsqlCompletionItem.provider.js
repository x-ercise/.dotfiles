"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const pldoc_controller_1 = require("./pldoc.controller");
const plsqlNavigator_vscode_1 = require("./plsqlNavigator.vscode");
const plsqlCompletionCustom_1 = require("./plsqlCompletionCustom");
const plsqlParser_vscode_1 = require("./plsqlParser.vscode");
class PLSQLCompletionItemProvider {
    constructor() {
        this.plDocController = new pldoc_controller_1.PLDocController();
        this.plsqlCompletionCustom = new plsqlCompletionCustom_1.default();
    }
    provideCompletionItems(document, position, token) {
        return new Promise((resolve, reject) => {
            const completeItems = [];
            const lineText = document.lineAt(position.line).text, text = document.getText(), wordRange = document.getWordRangeAtPosition(position), word = wordRange && document.getText(wordRange), cursorInfos = plsqlNavigator_vscode_1.PlSqlNavigatorVSC.getCursorInfos(document, position);
            if (!cursorInfos.previousDot) {
                // PLDOC
                const plDocItem = this.getPlDocItem(document, position, lineText, text);
                if (plDocItem)
                    completeItems.push(plDocItem);
                // PLDOC - custom items
                if (!this.plDocCustomItems)
                    this.plDocCustomItems = this.getPlDocCustomItems(document);
                Array.prototype.push.apply(completeItems, this.filterCompletion(this.plDocCustomItems, word));
                // PLSQL - snippets
                if (!this.plsqlSnippets)
                    this.plsqlSnippets = this.getSnippets();
                Array.prototype.push.apply(completeItems, this.filterCompletion(this.plsqlSnippets, word));
                // Custom completion
                const objects = this.getCompletionCustomItems(document);
                Array.prototype.push.apply(completeItems, this.filterCompletion(objects, word));
                // Current package completion
                const items = plsqlParser_vscode_1.default.getAllDeclaration(document);
                if (items) {
                    Array.prototype.push.apply(completeItems, this.filterCompletion(items.map(symbol => this.createSymbolItem(symbol)), word));
                }
                // TODO symbol in workspace
                return resolve(this.processCompleteItems(completeItems));
            }
            else {
                if (cursorInfos.previousWord) {
                    // 1. Use plsql.completion.json
                    const members = this.getCompletionCustomItems(document, cursorInfos.previousWord);
                    if (members && members.length) {
                        Array.prototype.push.apply(completeItems, members);
                        return resolve(this.processCompleteItems(completeItems));
                    }
                    // 2. Use Package member completion (spec)
                    this.getPackageItems(document, position, cursorInfos)
                        .then(items => {
                        Array.prototype.push.apply(completeItems, items);
                        return resolve(this.processCompleteItems(completeItems));
                    })
                        .catch(err => {
                        console.log(err);
                        return resolve(undefined);
                    });
                }
            }
        });
    }
    processCompleteItems(completeItems) {
        // completionItems must be filtered and if empty return undefined
        // otherwise word suggestion are lost ! (https://github.com/Microsoft/vscode/issues/21611)
        if (completeItems.length > 0)
            return completeItems;
    }
    filterCompletion(items, word) {
        // completionItems must be filtered and if empty return undefined
        // otherwise word suggestion are lost ! (https://github.com/Microsoft/vscode/issues/21611)
        if (items && word) {
            const wordL = word.toLowerCase();
            return items.filter(item => item.label.toLowerCase().startsWith(wordL));
        }
        else if (items)
            return items;
        else
            return [];
    }
    createSnippetItem(snippet, origin = '') {
        return this.createCompleteItem(vscode.CompletionItemKind.Snippet, snippet.prefix, snippet.description, snippet.body.join('\n'), origin);
    }
    createSymbolItem(symbol) {
        const symbolInfo = plsqlParser_vscode_1.default.getSymbolsCompletion(symbol);
        return this.createCompleteItem(symbolInfo.kind, symbolInfo.label, symbolInfo.documentation, symbolInfo.label, symbolInfo.detail);
    }
    createCompleteItem(type, label, doc = '', text = label, origin = '') {
        const item = new vscode.CompletionItem(label, type);
        if (type === vscode.CompletionItemKind.Snippet) {
            item.insertText = new vscode.SnippetString(text);
        }
        else
            item.insertText = text;
        item.documentation = doc;
        item.detail = origin;
        return item;
    }
    getPlDocItem(document, position, lineText, text) {
        // Empty line, above a function or procedure
        if ((text !== '') && (lineText.trim() === '') && (document.lineCount > position.line + 1)) {
            const nextPos = new vscode.Position(position.line + 1, 0), nextText = text.substr(document.offsetAt(nextPos));
            const snippet = this.plDocController.getDocSnippet(document, nextText);
            if (snippet)
                return this.createSnippetItem(snippet, 'pldoc');
        }
    }
    getPlDocCustomItems(document) {
        const snippets = this.plDocController.getCustomSnippets(document);
        if (snippets)
            return snippets.map(snippet => this.createSnippetItem(snippet));
        return [];
    }
    getSnippets() {
        if (vscode.workspace.getConfiguration('plsql-language').get('snippets.enable')) {
            const parsedJSON = require('../../snippets/plsql.snippets.json');
            return Object.keys(parsedJSON).map(key => this.createSnippetItem(parsedJSON[key], 'plsql.snippets'));
        }
        return [];
    }
    getPackageItems(document, position, cursorInfos) {
        return new Promise((resolve, reject) => {
            plsqlNavigator_vscode_1.PlSqlNavigatorVSC.complete(document, position, cursorInfos)
                .then(symbols => {
                if (symbols)
                    return resolve(symbols.map(symbol => this.createSymbolItem(symbol)));
                else
                    return resolve([]);
            })
                .catch(err => resolve([]));
        });
    }
    getCompletionCustomItems(document, text) {
        const items = this.plsqlCompletionCustom.getCompletion(document, text);
        if (items)
            return items.map(item => this.createCompleteItem(item.kind, item.label, item.documentation, item.label, 'plsql.completion'));
        return [];
    }
}
exports.PLSQLCompletionItemProvider = PLSQLCompletionItemProvider;
//# sourceMappingURL=plsqlCompletionItem.provider.js.map