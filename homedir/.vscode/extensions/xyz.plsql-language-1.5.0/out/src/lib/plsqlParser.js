"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const RegExParser_1 = require("./regEx/RegExParser");
const docFormater_1 = require("./docFormater");
class PlSqlParser {
    static initParser(symbolsComment) {
        this.getParser().initParser(symbolsComment);
    }
    static parseFile(fileName, content) {
        const root = this.getParser().getSymbols(content);
        if (root)
            root.fileName = fileName;
        return root;
    }
    static parseParams(symbol) {
        return this.getParser().parseParams(symbol);
    }
    static findSymbolByNameOffset(symbols, name, offset = 0, recursive = true) {
        // find first symbol after given offset
        const lower = name.toLowerCase();
        return this.findSymbol(symbols, symbol => (symbol.name.toLowerCase() === lower && symbol.offset >= offset), recursive);
    }
    static findSymbolNearOffset(symbols, offset, recursive = true) {
        // find last symbol with offset smaller than given offset
        let nearSymbol;
        this.findSymbol(symbols, (symbol) => {
            const result = (symbol.offset > offset);
            if (!result)
                nearSymbol = symbol;
            return result;
        }, recursive);
        return nearSymbol;
    }
    static findSymbolByNameKind(symbols, name, kind, recursive = true) {
        const lower = name.toLowerCase(), kindArray = Array.isArray(kind) ? kind : [kind];
        return this.findSymbol(symbols, symbol => (symbol.name.toLowerCase() === lower && kindArray.includes(symbol.kind)), recursive);
    }
    static getSymbolsDeclaration(root) {
        const allSymbols = [];
        this.forEachSymbol(root.symbols, symbol => {
            if (![3 /* function */, 5 /* procedure */,
                2 /* packageBody */, 1 /* packageSpec */].includes(symbol.kind))
                allSymbols.push(symbol);
        });
        return allSymbols;
    }
    // Body to Spec and Spec to Body
    static switchSymbol(symbol) {
        let kind;
        if (symbol.kind === 1 /* packageSpec */)
            kind = 2 /* packageBody */;
        else if (symbol.kind === 2 /* packageBody */)
            kind = 1 /* packageSpec */;
        else
            return symbol; // not a package
        return this.findSymbolByNameKind(symbol.root.symbols, symbol.name, kind, false);
    }
    // Body to Spec and Spec to Body
    static switchSymbolKind(symbolKind) {
        if (symbolKind === 4 /* functionSpec */)
            return 3 /* function */;
        else if (symbolKind === 3 /* function */)
            return 4 /* functionSpec */;
        else if (symbolKind === 6 /* procedureSpec */)
            return 5 /* procedure */;
        else if (symbolKind === 5 /* procedure */)
            return 6 /* procedureSpec */;
        else if (symbolKind === 1 /* packageSpec */)
            return 2 /* packageBody */;
        else if (symbolKind === 2 /* packageBody */)
            return 1 /* packageSpec */;
        else
            return symbolKind;
    }
    static isSymbolSpec(symbol) {
        return [1 /* packageSpec */, 6 /* procedureSpec */, 4 /* functionSpec */]
            .includes(symbol.kind);
    }
    static getSymbols(fileName, content) {
        return this.getSymbolsFromRoot(this.parseFile(fileName, content));
    }
    static getSymbolsFromRoot(root) {
        const allSymbols = [];
        this.forEachSymbol(root.symbols, symbol => {
            allSymbols.push(symbol);
        });
        return allSymbols;
    }
    static getSymbolFileName(symbol) {
        while (symbol.parent)
            symbol = symbol.parent;
        return symbol.root.fileName;
    }
    static formatSymbolDocumentation(symbol, useJSDoc) {
        if (symbol.documentation && !symbol.formatedDoc) {
            symbol.formatedDoc = {
                text: docFormater_1.default.format(symbol.documentation, useJSDoc),
                isMarkdown: useJSDoc
            };
        }
    }
    static forEachSymbol(symbols, fn) {
        if (symbols)
            symbols.forEach(symbol => {
                fn.apply(this, [symbol]);
                this.forEachSymbol(symbol.symbols, fn);
            });
    }
    static findSymbol(symbols, fn, recursive = true) {
        if (!symbols)
            return;
        let result;
        for (let symbol of symbols) {
            if (fn.apply(this, [symbol]))
                return symbol;
            if (recursive) {
                result = this.findSymbol(symbol.symbols, fn);
                if (result)
                    return result;
            }
        }
    }
    static getParser() {
        return RegExParser_1.default;
        // return AntlrParser;
    }
}
exports.default = PlSqlParser;
//# sourceMappingURL=plsqlParser.js.map