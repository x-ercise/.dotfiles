"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const plsqlDefinition_provider_1 = require("./plsqlDefinition.provider");
const plsqlDocumentSymbol_provider_1 = require("./plsqlDocumentSymbol.provider");
const plsqlCompletionItem_provider_1 = require("./plsqlCompletionItem.provider");
const plsqlHover_provider_1 = require("./plsqlHover.provider");
const plsqlSignature_provider_1 = require("./plsqlSignature.provider");
const plsql_settings_1 = require("./plsql.settings");
const connect_controller_1 = require("./connect.controller");
const connectUI_controller_1 = require("./connectUI.controller");
const connect_statusBar_1 = require("./connect.statusBar");
function activate(context) {
    // Default without $# redefinded here
    // because plsql.configuration.json don't work with getWordRangeAtPosition() according to issue #42649
    vscode.languages.setLanguageConfiguration('plsql', {
        wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\%\^\&\*\(\)\-\=\+\[\{\]\}\|\;\:\'\"\,\.\<\>\/\?\s]+)/
    });
    let hoverProvider, signatureHelpProvider;
    // language providers
    activateHover();
    activateSignatureHelp();
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('plsql', new plsqlCompletionItem_provider_1.PLSQLCompletionItemProvider(), '.', '\"'));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider('plsql', new plsqlDefinition_provider_1.PLSQLDefinitionProvider()));
    // context.subscriptions.push(vscode.languages.registerReferenceProvider('plsql', new PLSQLReferenceProvider()));
    // context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider('plsql', new PLSQLDocumentFormattingEditProvider()));
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider('plsql', new plsqlDocumentSymbol_provider_1.PLSQLDocumentSymbolProvider()));
    // context.subscriptions.push(vscode.languages.registerWorkspaceSymbolProvider(new PLSQLWorkspaceSymbolProvider()));
    // context.subscriptions.push(vscode.languages.registerRenameProvider('plsql', new PLSQLRenameProvider()));
    // context.subscriptions.push(vscode.languages.registerCodeActionsProvider('plsql', new PLSQLCodeActionProvider()));
    // Connection
    const connectController = new connect_controller_1.ConnectController();
    const connectStatusBar = new connect_statusBar_1.ConnectStatusBar(connectController);
    const connectUIController = new connectUI_controller_1.default(context, connectController);
    context.subscriptions.push(vscode.commands.registerCommand('plsql.activateConnection', connectUIController.activateConnectionsList, connectUIController));
    vscode.workspace.onDidChangeConfiguration(configChangedEvent => {
        if (!configChangedEvent.affectsConfiguration('plsql-language'))
            return;
        connectController.configurationChanged();
        if (configChangedEvent.affectsConfiguration('plsql-language.signatureHelp'))
            activateSignatureHelp();
        if (configChangedEvent.affectsConfiguration('plsql-language.hover'))
            activateHover();
    });
    function activateHover() {
        const enable = plsql_settings_1.PLSQLSettings.getHoverEnable();
        if (!hoverProvider && enable) {
            hoverProvider = new plsqlHover_provider_1.PLSQLHoverProvider();
            context.subscriptions.push(vscode.languages.registerHoverProvider('plsql', hoverProvider));
        }
        if (hoverProvider)
            hoverProvider.enable = enable;
    }
    function activateSignatureHelp() {
        const enable = plsql_settings_1.PLSQLSettings.getSignatureEnable();
        if (!signatureHelpProvider && enable) {
            signatureHelpProvider = new plsqlSignature_provider_1.PLSQLSignatureProvider();
            context.subscriptions.push(vscode.languages.registerSignatureHelpProvider('plsql', signatureHelpProvider, '(', ','));
        }
        if (signatureHelpProvider)
            signatureHelpProvider.enable = enable;
    }
}
exports.activate = activate;
// function deactivate() {
// }
//# sourceMappingURL=extension.js.map