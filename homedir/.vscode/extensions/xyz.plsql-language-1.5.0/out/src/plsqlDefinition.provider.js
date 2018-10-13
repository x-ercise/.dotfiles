"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const plsqlParser_vscode_1 = require("./plsqlParser.vscode");
const plsqlNavigator_vscode_1 = require("./plsqlNavigator.vscode");
class PLSQLDefinitionProvider {
    provideDefinition(document, position, token) {
        return new Promise((resolve, reject) => {
            plsqlNavigator_vscode_1.PlSqlNavigatorVSC.goto(document, position)
                .then(symbol => {
                return this.getFileLocation(symbol);
            })
                .then(location => {
                return resolve(location);
            })
                .catch(err => {
                reject(err);
            });
        });
    }
    getFileLocation(navigateSymbol) {
        return new Promise((resolve, reject) => {
            if (navigateSymbol)
                vscode.workspace.openTextDocument(plsqlParser_vscode_1.default.getSymbolFileName(navigateSymbol))
                    .then(document => {
                    resolve(this.getLocation(document, navigateSymbol));
                });
            else
                resolve();
        });
    }
    getLocation(document, navigateSymbol) {
        if (navigateSymbol)
            return new vscode.Location(vscode.Uri.file(document.fileName), document.positionAt(navigateSymbol.offset));
        else
            return null;
    }
}
exports.PLSQLDefinitionProvider = PLSQLDefinitionProvider;
//# sourceMappingURL=plsqlDefinition.provider.js.map