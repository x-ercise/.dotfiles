"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Parser using regExp
 * (try to parse even with some errors (begin,end,is,as...missing or too much))
 */
class RegExpParser {
    static initParser(commentInSymbols) {
        const regExpParser = `${RegExpParser.regComment}|${RegExpParser.regSymbolsCreate}(?:${RegExpParser.regSymbols}` +
            `${commentInSymbols ? RegExpParser.regCommentInside : ''}` +
            `${RegExpParser.regSymbolsName})`;
        this.regExp = new RegExp(regExpParser, 'gi');
        this.regExpS = new RegExp(`${this.regCommentDoc}|${`(\\b(?:end|create)\\b)`}|${this.regSpecSymbols}`, 'gi');
        this.regExpB = new RegExp(`${this.regCommentDoc}|${this.regBody}|(\\bbegin\\b)|${this.regSpecSymbols}`, 'gi');
        this.regExpJumpEnd = new RegExp(`${this.regComment}|${this.regJumpEnd}`, 'gi');
        this.regExpJumpAsIs = new RegExp(`${this.regJumpAsIs}`, 'gi');
        this.regExpJumpDoc = new RegExp(`${this.regJumpDoc}\\s*$`, 'gi');
        this.regExpParams = new RegExp(`${this.regParams}`, 'gi');
    }
    static getSymbols(text, fileName) {
        if (!this.regExp)
            this.initParser();
        const root = {
            fileName: fileName,
            symbols: []
        };
        let found, isBody, symbol, parent, fromOffset, offset = 0;
        this.regExp.lastIndex = 0;
        while (found = this.regExp.exec(text)) {
            if (found[2]) {
                // package body or create func or create proc
                isBody = (found[3] != null) || (found[1] != null && found[2].toLowerCase() !== 'package');
                symbol = {
                    name: found[4],
                    offset: found.index,
                    kindName: found[2] + (found[3] != null ? ' ' + found[3] : ''),
                    kind: this.getSymbolKind(found[2].toLowerCase(), isBody)
                };
                if (!parent || found[1]) {
                    symbol.root = root;
                    root.symbols.push(symbol);
                    symbol.symbols = [];
                    parent = symbol;
                }
                else {
                    symbol.parent = parent;
                    parent.symbols.push(symbol);
                }
                // level 1 (create package, proc or func)
                if (parent === symbol) {
                    offset = this.regExp.lastIndex;
                    fromOffset = this.jumpAsIs(text, offset);
                    if (fromOffset !== offset) { // if equal => no is|as => continue on same level...
                        symbol.definition = found[0] + text.substring(offset, fromOffset - 2);
                        offset = fromOffset;
                        if (symbol.kind === 1 /* packageSpec */)
                            offset = this.getSymbolsSpec(text, offset, symbol);
                        else // symbol.kind in package_body / func / proc
                            offset = this.getSymbolsBody(text, offset, symbol);
                        this.regExp.lastIndex = offset;
                        // jumptoend to find real offsetEnd
                        offset = this.jumpToEnd(text, offset);
                        symbol.offsetEnd = offset;
                    }
                }
            }
        }
        return root;
    }
    static parseParams(symbol) {
        if (symbol.params || !symbol.definition)
            return symbol.params;
        symbol.params = [];
        let found;
        while (found = this.regExpParams.exec(symbol.definition)) {
            if (found[1])
                symbol.params.push({
                    text: found[1],
                    name: found[2],
                    type: found[4],
                    kind: this.getParamKind(found[3]) // todo: convert
                });
            else // if (found[5])
                symbol.params.push({
                    text: found[0],
                    type: found[5],
                    kind: 1 /* return */
                });
        }
        return symbol.params;
    }
    /// (only for spec)
    // PRAGMA
    //
    /// (for spec and body)
    // SUBTYPE identifier
    // identifier // variable
    // identifier CONSTANT // constant
    // CURSOR identifier
    // identifier EXCEPTION
    // TYPE identifier
    // PROCEDURE identifier
    // FUNCTION identifier
    //
    /// (only for body)
    // PROCEDURE identifier Body
    // FUNCTION identifier Body
    static getSymbolsSpec(text, fromOffset, parent) {
        let found, lastIndex = fromOffset, lastDoc = null, symbol;
        this.regExpS.lastIndex = lastIndex;
        while (found = this.regExpS.exec(text)) {
            if (found[1]) { // doc
                lastDoc = found.index;
                continue;
            }
            else if (found[3] && found[4]) {
                symbol = this.createSymbolItem(found[3], found[4], found.index, parent, false);
                if (symbol) {
                    symbol.definition = found[0];
                    symbol.offsetEnd = this.regExpS.lastIndex;
                    if (lastDoc != null)
                        symbol.documentation = this.jumpDoc(text, lastDoc, found.index);
                }
            }
            else if (found[2]) // end || create
                break;
            lastIndex = this.regExpS.lastIndex;
            lastDoc = null;
        }
        return lastIndex;
    }
    static getSymbolsBody(text, fromOffset, parent, extractSymbol = true) {
        let found, symbol, lastIndex = fromOffset, lastDoc = null, oldIndex, isBody;
        this.regExpB.lastIndex = lastIndex;
        while (found = this.regExpB.exec(text)) {
            if (found[1]) { // doc
                lastDoc = found.index;
                continue;
            }
            oldIndex = lastIndex;
            lastIndex = this.regExpB.lastIndex;
            if (found[5]) // begin
                break;
            else if (found[6] && found[7]) {
                if (extractSymbol) {
                    symbol = this.createSymbolItem(found[6], found[7], found.index, parent, false);
                    if (symbol) {
                        symbol.definition = found[0];
                        symbol.offsetEnd = lastIndex;
                        if (lastDoc != null)
                            symbol.documentation = this.jumpDoc(text, lastDoc, found.index);
                    }
                    else {
                        // if it's not a symbol, something goes wrong => break
                        lastIndex = oldIndex;
                        break;
                    }
                }
            }
            else if (found[2] && found[3]) { // function, procedure
                // Declare function, procedure => add symbol
                if (!parent.symbols)
                    parent.symbols = [];
                isBody = found[4].toLowerCase() !== ';';
                symbol = this.createSymbolItem(found[2], found[3], found.index, parent, isBody);
                if (symbol) {
                    symbol.definition = found[0];
                    if (lastDoc != null)
                        symbol.documentation = this.jumpDoc(text, lastDoc, found.index);
                    if (isBody) {
                        if (found[4].toLowerCase() === 'begin') {
                            // begin => jump to end
                        }
                        else { // is,as
                            // read between is and begin (subPro/subFunc)
                            lastIndex = this.getSymbolsBody(text, lastIndex, symbol, false);
                        }
                        // jump to end
                        lastIndex = this.jumpToEnd(text, lastIndex);
                        symbol.offsetEnd = lastIndex;
                        this.regExpB.lastIndex = lastIndex;
                    }
                }
            }
            lastDoc = null;
        }
        return lastIndex;
    }
    static createSymbolItem(text1, text2, offset, parent, isBody) {
        let kindName, identifier, symbol;
        if (text1 && text2) {
            if (['subtype', 'cursor', 'type', 'function', 'procedure'].includes(text1.toLowerCase())) {
                kindName = text1;
                identifier = text2;
            }
            else if (text2 && ['constant', 'exception'].includes(text2.toLowerCase())) {
                kindName = text2;
                identifier = text1;
            }
            else if (!(['pragma', 'create', 'end'].includes(text1.toLowerCase()))) {
                // TODO other keyword to avoid variable return...
                kindName = 'variable';
                identifier = text1;
            }
            if (kindName) {
                symbol = {
                    name: identifier,
                    offset: offset,
                    kindName: kindName,
                    kind: this.getSymbolKind(kindName.toLowerCase(), isBody),
                    parent: parent
                };
                parent.symbols.push(symbol);
                return symbol;
            }
        }
    }
    static jumpAsIs(text, fromOffset) {
        let match;
        this.regExpJumpAsIs.lastIndex = fromOffset;
        match = this.regExpJumpAsIs.exec(text);
        if (match)
            return this.regExpJumpAsIs.lastIndex;
        return fromOffset;
    }
    static jumpDoc(text, fromOffset, toOffset) {
        // find doc above a symbol
        let match;
        text = text.substr(0, toOffset);
        this.regExpJumpDoc.lastIndex = fromOffset;
        match = this.regExpJumpDoc.exec(text);
        if (match)
            return match[0];
        return '';
    }
    static jumpToEnd(text, fromOffset) {
        let match, openTokens = 1, // begin was already found
        lastIndex = fromOffset;
        this.regExpJumpEnd.lastIndex = fromOffset;
        while (match = this.regExpJumpEnd.exec(text)) {
            lastIndex = this.regExpJumpEnd.lastIndex;
            if (match[1]) { // begin | case
                openTokens++;
            }
            else if (match[2]) { // end
                if (!match[3] || match[3].toLowerCase() === 'case') {
                    if (openTokens) {
                        openTokens--;
                        if (!openTokens)
                            return lastIndex;
                    }
                    else
                        return lastIndex; // end without begin (error in file !)
                } // else end loop|if
            } // else comment => nothing todo
        }
        return lastIndex;
    }
    static getSymbolKind(type, isBody) {
        if (type === 'function') {
            if (isBody)
                return 3 /* function */;
            else
                return 4 /* functionSpec */;
        }
        else if (type === 'procedure') {
            if (isBody)
                return 5 /* procedure */;
            else
                return 6 /* procedureSpec */;
        }
        else if (type === 'package') {
            if (isBody)
                return 2 /* packageBody */;
            else
                return 1 /* packageSpec */;
        }
        else if (type === 'constant')
            return 8 /* constant */;
        else if (type === 'type')
            return 9 /* type */;
        else if (type === 'subtype')
            return 10 /* subtype */;
        else if (type === 'cursor')
            return 11 /* cursor */;
        else if (type === 'exception')
            return 12 /* exception */;
        else
            return 7 /* variable */;
    }
    static getParamKind(type) {
        if (type === 'in')
            return 2 /* in */;
        if (type === 'out')
            return 3 /* out */;
        if (type === 'inout')
            return 4 /* inout */;
        if (type === 'return')
            return 1 /* return */;
        else
            return 0 /* none */;
    }
}
RegExpParser.regComment = `(?:\\/\\*[\\s\\S]*?\\*\\/)|(?:--.*)`;
RegExpParser.regCommentDoc = `(?:\\/\\*(\\*)?[\\s\\S]*?\\*\\/)|(?:--.*)`;
RegExpParser.regCommentInside = `(?:\\/\\*[\\s\\S]*?\\*\\/\\s*)?`; // a bit slower !
RegExpParser.regJumpDoc = `(\\/\\*\\*[\\s\\S]*?\\*\\/)`;
RegExpParser.REG_WORD = "[\\w\\$#]";
RegExpParser.REG_WORDTYPE = "[\\w\\$#%\\.]"; // param type on the form  xyztable.xyzfield%type
RegExpParser.regSymbolsCreate = `(?:(create)(?:\\s+or\\s+replace)?\\s+)?`;
RegExpParser.regSymbols = `(?:\\b(function|procedure|package)\\b(?:\\s+(body))?)\\s+`;
RegExpParser.regSymbolsName = `(?:\"?${RegExpParser.REG_WORD}+\"?\\.)?\"?(${RegExpParser.REG_WORD}+)\"?`;
RegExpParser.regSpecSymbols = `(?:(${RegExpParser.REG_WORD}+)\\s+(${RegExpParser.REG_WORD}+)\\s*(?:\\s*;|.[^;]*;))`;
RegExpParser.regBody = `(?:\\b(procedure|function)\\b\\s+(${RegExpParser.REG_WORD}+)[\\s\\S]*?(;|\\b(?:is|as|begin)\\b))`;
RegExpParser.regParams = `(?:\\(|,)\\s*((${RegExpParser.REG_WORD}+)\\s*(in\\s+out|in|out)?\\s*(${RegExpParser.REG_WORDTYPE}*))|(?:\\breturn\\b\\s*(${RegExpParser.REG_WORDTYPE}*))`;
RegExpParser.regJumpEnd = `(\\bbegin|case\\b)|(?:(\\bend\\b)\\s*(?:\\b(if|loop|case)\\b)?)`;
RegExpParser.regJumpAsIs = `\\b(is|as)\\b`;
exports.default = RegExpParser;
//# sourceMappingURL=RegExParser.js.map