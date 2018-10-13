"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const plsqlNavigator_vscode_1 = require("./plsqlNavigator.vscode");
const plsqlParser_vscode_1 = require("./plsqlParser.vscode");
class PLSQLSignatureProvider {
    provideSignatureHelp(document, position, token) {
        return new Promise((resolve, reject) => {
            if (!this.enable)
                resolve();
            let theCall = this.walkBackwardsToBeginningOfCall(document, position);
            if (theCall == null)
                return resolve(null);
            let callerPos = this.previousTokenPosition(document, theCall.openParen);
            // TODO use cache
            plsqlNavigator_vscode_1.PlSqlNavigatorVSC.getDeclaration(document, callerPos)
                .then(symbol => {
                if (symbol) {
                    let result = new vscode.SignatureHelp(), si;
                    const symbolDoc = plsqlParser_vscode_1.default.getFormatSymbolDocumentation(symbol);
                    si = new vscode.SignatureInformation(symbol.definition, symbolDoc);
                    si.parameters = plsqlParser_vscode_1.default.parseParams(symbol)
                        .filter(p => p.kind !== 1 /* return */)
                        .map(p => new vscode.ParameterInformation(p.text));
                    result.signatures = [si];
                    result.activeSignature = 0;
                    result.activeParameter = Math.min(theCall.commas.length, si.parameters.length - 1);
                    return resolve(result);
                }
                else
                    return resolve(null);
            })
                .catch(err => {
                reject(err);
            });
        });
    }
    walkBackwardsToBeginningOfCall(document, position) {
        let parenBalance = 0;
        let commas = [];
        let maxLookupLines = 30;
        for (let line = position.line; line >= 0 && maxLookupLines >= 0; line--, maxLookupLines--) {
            let currentLine = document.lineAt(line).text;
            let characterPosition = document.lineAt(line).text.length - 1;
            if (line === position.line) {
                characterPosition = position.character;
                currentLine = currentLine.substring(0, position.character);
            }
            for (let char = characterPosition; char >= 0; char--) {
                switch (currentLine[char]) {
                    case '(':
                        parenBalance--;
                        if (parenBalance < 0) {
                            return {
                                openParen: new vscode.Position(line, char),
                                commas: commas
                            };
                        }
                        break;
                    case ')':
                        parenBalance++;
                        break;
                    case ',':
                        if (parenBalance === 0) {
                            commas.push(new vscode.Position(line, char));
                        }
                }
            }
        }
        return null;
    }
    previousTokenPosition(document, position) {
        while (position.character > 0) {
            let word = document.getWordRangeAtPosition(position);
            if (word) {
                return word.start;
            }
            position = position.translate(0, -1);
        }
        return null;
    }
}
exports.PLSQLSignatureProvider = PLSQLSignatureProvider;
// /**
//  * @desription
//  *    My description multi-lines
//  *    second line
//  * @param {string} Texte Description
//  * @param {number} Texte Description
//  * @return {number} Description
//  *
//  */
// _@description_ -
// My description multi-lines
// second line
// <br> _@param_ **string** `Texte` - description
// <br> _@param_ **number** `Texte` - description
// <br> _@return_ **number** - description
//# sourceMappingURL=plsqlSignature.provider.js.map