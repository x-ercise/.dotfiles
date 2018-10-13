"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const plsqlParser_vscode_1 = require("./plsqlParser.vscode");
const plsql_settings_1 = require("./plsql.settings");
class PLSQLDocumentSymbolProvider {
    provideDocumentSymbols(document, token) {
        plsqlParser_vscode_1.default.initParser(plsql_settings_1.PLSQLSettings.getCommentInSymbols());
        return plsqlParser_vscode_1.default.getAllSymbols(document);
    }
}
exports.PLSQLDocumentSymbolProvider = PLSQLDocumentSymbolProvider;
//# sourceMappingURL=plsqlDocumentSymbol.provider.js.map