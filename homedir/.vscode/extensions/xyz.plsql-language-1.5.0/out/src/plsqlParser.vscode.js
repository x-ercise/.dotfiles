"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const plsqlParser_1 = require("./lib/plsqlParser");
class PlSqlParserVSC extends plsqlParser_1.default {
    static parseDocument(document) {
        return this.parseFile(document.fileName, document.getText());
    }
    static parseParams(symbol) {
        return plsqlParser_1.default.parseParams(symbol);
    }
    static getAllSymbols(document) {
        const root = this.parseFile(document.fileName, document.getText());
        return root.symbols.map(symbol => this.getSymbolInformation(document, symbol));
    }
    static getAllDeclaration(document) {
        const root = this.parseFile(document.fileName, document.getText());
        return plsqlParser_1.default.getSymbolsDeclaration(root);
    }
    static getSymbolsCompletion(symbol) {
        return {
            label: symbol.name,
            documentation: this.getFormatSymbolDocumentation(symbol),
            kind: this.convertToCompletionKind(symbol.kind),
            detail: symbol.definition
        };
    }
    static getFormatSymbolDocumentation(symbol) {
        if (!symbol.documentation)
            return '';
        const useJsDoc = symbol.documentation.indexOf('@') !== -1;
        plsqlParser_1.default.formatSymbolDocumentation(symbol, useJsDoc);
        let symbolDoc;
        if (symbol.formatedDoc.isMarkdown)
            symbolDoc = new vscode.MarkdownString(symbol.formatedDoc.text);
        else
            symbolDoc = symbol.formatedDoc.text;
        return symbolDoc;
    }
    static getSymbolInformation(document, symbol) {
        const line = symbol.offset != null ? document.lineAt(document.positionAt(symbol.offset)) : document.lineAt(0) /*document.lineAt(symbol.line)*/;
        const lineEnd = symbol.offsetEnd != null ? document.lineAt(document.positionAt(symbol.offsetEnd)) : line;
        const result = new vscode.DocumentSymbol(symbol.kindName + ' ' + symbol.name, '', this.convertToSymbolKind(symbol.kind), 
        // symbol.parent ? symbol.parent.kindName+' '+symbol.parent.name : '',
        // new vscode.Location(document.uri, new vscode.Range(line.range.start, line.range.end))
        new vscode.Range(line.range.start, lineEnd.range.end), new vscode.Range(line.range.start, lineEnd.range.end));
        if (symbol.symbols)
            result.children = symbol.symbols.map(item => this.getSymbolInformation(document, item));
        return result;
    }
    static convertToSymbolKind(kind) {
        switch (kind) {
            case 1 /* packageSpec */:
                return vscode.SymbolKind.Package;
            case 2 /* packageBody */:
                return vscode.SymbolKind.Package;
            case 3 /* function */:
                return vscode.SymbolKind.Function;
            case 4 /* functionSpec */:
                // return vscode.SymbolKind.Function;
                return vscode.SymbolKind.Interface;
            case 5 /* procedure */:
                return vscode.SymbolKind.Method;
            case 6 /* procedureSpec */:
                // return vscode.SymbolKind.Method;
                return vscode.SymbolKind.Interface;
            case 7 /* variable */:
                return vscode.SymbolKind.Variable;
            case 8 /* constant */:
                return vscode.SymbolKind.Constant;
            case 9 /* type */:
            case 10 /* subtype */:
            case 11 /* cursor */:
            case 12 /* exception */:
                return vscode.SymbolKind.Struct;
        }
    }
    static convertToCompletionKind(kind) {
        switch (kind) {
            case 1 /* packageSpec */:
                return vscode.CompletionItemKind.Unit; // Package;
            case 2 /* packageBody */:
                return vscode.CompletionItemKind.Unit; // Package;
            case 3 /* function */:
                return vscode.CompletionItemKind.Function;
            case 4 /* functionSpec */:
                return vscode.CompletionItemKind.Function;
            // return vscode.CompletionItemKind.Interface;
            case 5 /* procedure */:
                return vscode.CompletionItemKind.Method;
            case 6 /* procedureSpec */:
                return vscode.CompletionItemKind.Method;
            // return vscode.CompletionItemKind.Interface;
            case 7 /* variable */:
                return vscode.CompletionItemKind.Variable;
            case 8 /* constant */:
                return vscode.CompletionItemKind.Constant;
            case 9 /* type */:
            case 10 /* subtype */:
            case 11 /* cursor */:
            case 12 /* exception */:
                return vscode.CompletionItemKind.Struct;
        }
    }
}
exports.default = PlSqlParserVSC;
//# sourceMappingURL=plsqlParser.vscode.js.map