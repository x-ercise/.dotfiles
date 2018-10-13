"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const plsqlNavigator_vscode_1 = require("./plsqlNavigator.vscode");
const plsqlParser_vscode_1 = require("./plsqlParser.vscode");
class PLSQLHoverProvider {
    provideHover(document, position, token) {
        return new Promise((resolve, reject) => {
            if (!this.enable)
                resolve();
            // TODO use cache
            plsqlNavigator_vscode_1.PlSqlNavigatorVSC.getDeclaration(document, position)
                .then(symbol => {
                if (symbol) {
                    const hoverText = [];
                    let value;
                    if (symbol.definition)
                        value = symbol.definition;
                    else
                        value = symbol.kindName;
                    hoverText.push({ language: 'plsql', value: value });
                    if (symbol.documentation) {
                        const symbolDoc = plsqlParser_vscode_1.default.getFormatSymbolDocumentation(symbol);
                        hoverText.push(symbolDoc);
                    }
                    resolve(new vscode.Hover(hoverText));
                }
                else
                    resolve();
            })
                .catch(err => {
                reject(err);
            });
        });
    }
}
exports.PLSQLHoverProvider = PLSQLHoverProvider;
//# sourceMappingURL=plsqlHover.provider.js.map