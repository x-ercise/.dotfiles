"use strict";
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const codeConverter = require("vscode-languageclient/lib/codeConverter");
const protocolConverter = require("vscode-languageclient/lib/protocolConverter");
const vscodeLSP = require("vscode-languageserver-protocol");
const CircularJson = require("circular-json");
const config_1 = require("../config");
const code2protocolExtension_1 = require("./code2protocolExtension");
const commandHandler = require("./commandHandler");
const universalLanguageServerProvider_1 = require("./universalLanguageServerProvider");
const languageServiceTelemetry_1 = require("../telemetry/languageServiceTelemetry");
const telemetry_1 = require("../telemetry/telemetry");
const config = require("../config");
const telemetryFilters_1 = require("../telemetry/telemetryFilters");
const restrictedOperation_1 = require("../accessControl/restrictedOperation");
exports.REMOTE_COMMAND_NAME = '_liveshare.remotecommand';
let universalProvider;
const telemetryFilter = new telemetryFilters_1.SendOnceFilter(languageServiceTelemetry_1.LanguageServiceTelemetryEventNames.GET_DIAGNOSTICS_FAULT);
async function activateAsync(workspaceService, clientAccessCheck) {
    telemetry_1.Instance.addFilter(telemetryFilter);
    if (config_1.featureFlags.lsp) {
        universalProvider = new universalLanguageServerProvider_1.UniversalLanguageServerProvider(workspaceService);
        await universalProvider.initAsync();
        setupHandlers(universalProvider, clientAccessCheck);
    }
}
exports.activateAsync = activateAsync;
async function dispose() {
    telemetryFilter.reset();
    if (universalProvider) {
        await universalProvider.dispose();
    }
}
exports.dispose = dispose;
async function getExternalDocumentAsync(pathManager, uri, token) {
    let originalUri = pathManager.getOriginalUri(uri);
    let document = await vscode.workspace.openTextDocument(originalUri);
    return document.getText();
}
const codeActionOperation = { name: restrictedOperation_1.WellKnownRestrictedOperations.CodeAction };
function setupHandlers(languageServerProvider, clientAccessCheck) {
    let connection = languageServerProvider.createProtocolConnection();
    let p2c = protocolConverter.createConverter((value) => { return languageServerProvider.PathManager.protocol2CodeUriConverter(value); });
    let c2p = codeConverter.createConverter((value) => { return languageServerProvider.PathManager.code2ProtocolUriConverter(value); });
    let c2pExt = code2protocolExtension_1.createConverterExtension(c2p);
    try {
        // Setup diagnostics
        vscode.languages.onDidChangeDiagnostics((e) => {
            for (let uri of e.uris) {
                try {
                    let diagnostics = vscode.languages.getDiagnostics(uri);
                    let params = {
                        uri: c2p.asUri(uri),
                        diagnostics: c2p.asDiagnostics(diagnostics)
                    };
                    connection.sendNotification(vscodeLSP.PublishDiagnosticsNotification.type.method, params);
                }
                catch (e) {
                    // Even if we fail to get diagnostics for one URI, we should still continue with the rest
                    telemetry_1.Instance.sendFault(languageServiceTelemetry_1.LanguageServiceTelemetryEventNames.GET_DIAGNOSTICS_FAULT, telemetry_1.FaultType.NonBlockingFault, 'Unable to get diagnostics', e);
                }
            }
        });
    }
    catch ( /* vscode.languages.onDidChangeDiagnostics is a new API that may not be available */_a) { /* vscode.languages.onDidChangeDiagnostics is a new API that may not be available */ }
    connection.onRequest(vscodeLSP.InitializeRequest.type, (params) => {
        console.log('Initialize Request received');
        let capabilities = {
            hoverProvider: true,
            definitionProvider: true,
            typeDefinitionProvider: true,
            referencesProvider: true,
            implementationProvider: true,
            completionProvider: {
                triggerCharacters: ['.']
            },
            signatureHelpProvider: {
                triggerCharacters: ['(', ',']
            },
            //documentHighlightProvider: true, // Disabled due to https://github.com/Microsoft/vscode/issues/44848
            documentSymbolProvider: true,
            workspaceSymbolProvider: true,
            codeActionProvider: true,
            //codeLensProvider: {resolveProvider: false}, // Disabled due to https://github.com/Microsoft/vscode/issues/44846
            documentFormattingProvider: true,
            documentRangeFormattingProvider: true,
            documentOnTypeFormattingProvider: {
                firstTriggerCharacter: '}',
                moreTriggerCharacter: [';', '\n']
            },
            renameProvider: true,
            documentLinkProvider: {
                resolveProvider: false
            },
            colorProvider: true,
            executeCommandProvider: { commands: [] },
            codeLensProvider: {
                resolveProvider: true
            }
        };
        let result = {
            capabilities
        };
        return result;
    });
    connection.onCustomRequest('liveshare/externalDocument', async (params, token) => {
        const uri = params.textDocument.uri;
        return await getExternalDocumentAsync(languageServerProvider.PathManager, uri, token);
    });
    connection.onCustomRequest('liveshare/load', async (params) => {
        return null;
    });
    connection.onCustomRequest('liveshare/diagnosticsDocument', async (params) => {
        let uri = params.textDocument.uri;
        return c2p.asDiagnostics(vscode.languages.getDiagnostics(p2c.asUri(uri)));
    });
    connection.onRequest(vscodeLSP.HoverRequest.type, async (params) => {
        let uri = p2c.asUri(params.textDocument.uri);
        let position = p2c.asPosition(params.position);
        let hovers = await vscode.commands.executeCommand('vscode.executeHoverProvider', uri, position);
        if (!hovers || hovers.length === 0) {
            return null;
        }
        // LSP lets us return only one hover but we may have hovers from multiple providers. Merge them into one.
        let mergedContents = hovers.map((v) => v.contents).reduce((prev, curr, index, arr) => prev.concat(curr));
        let mergedHover = new vscode.Hover(mergedContents, hovers[0].range);
        return c2pExt.asHover(mergedHover);
    });
    connection.onRequest(vscodeLSP.DefinitionRequest.type, async (params) => {
        let uri = p2c.asUri(params.textDocument.uri);
        let position = p2c.asPosition(params.position);
        let definition = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', uri, position);
        return c2pExt.asDefinitionResult(definition);
    });
    connection.onRequest(vscodeLSP.TypeDefinitionRequest.type, async (params) => {
        let uri = p2c.asUri(params.textDocument.uri);
        let position = p2c.asPosition(params.position);
        let typeDefinition;
        try {
            typeDefinition = await vscode.commands.executeCommand('vscode.executeTypeDefinitionProvider', uri, position);
        }
        catch (e) { /* go to type definition is a new feature that may not be supported */ }
        return typeDefinition ? typeDefinition.map(d => c2pExt.asLocation(d)) : null;
    });
    connection.onRequest(vscodeLSP.ReferencesRequest.type, async (params) => {
        let uri = p2c.asUri(params.textDocument.uri);
        let position = p2c.asPosition(params.position);
        let references = await vscode.commands.executeCommand('vscode.executeReferenceProvider', uri, position);
        return c2pExt.asReferences(references);
    });
    connection.onRequest(vscodeLSP.ImplementationRequest.type, async (params) => {
        let uri = p2c.asUri(params.textDocument.uri);
        let position = p2c.asPosition(params.position);
        let definition = await vscode.commands.executeCommand('vscode.executeImplementationProvider', uri, position);
        return c2pExt.asDefinitionResult(definition);
    });
    connection.onRequest(vscodeLSP.DocumentHighlightRequest.type, async (params) => {
        let uri = p2c.asUri(params.textDocument.uri);
        let position = p2c.asPosition(params.position);
        let highlights = await vscode.commands.executeCommand('vscode.executeDocumentHighlights', uri, position);
        return c2pExt.asDocumentHighlights(highlights);
    });
    connection.onRequest(vscodeLSP.CompletionRequest.type, async (params) => {
        let uri = p2c.asUri(params.textDocument.uri);
        let position = p2c.asPosition(params.position);
        let list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', uri, position, params.context ? params.context.triggerCharacter : undefined);
        if (!list) {
            return undefined;
        }
        return list.items.map(item => c2p.asCompletionItem(item));
    });
    connection.onRequest(vscodeLSP.SignatureHelpRequest.type, async (params) => {
        let uri = p2c.asUri(params.textDocument.uri);
        let position = p2c.asPosition(params.position);
        let sigHelp = await vscode.commands.executeCommand('vscode.executeSignatureHelpProvider', uri, position);
        return c2pExt.asSignatureHelp(sigHelp);
    });
    connection.onRequest(vscodeLSP.DocumentSymbolRequest.type, async (params) => {
        let uri = p2c.asUri(params.textDocument.uri);
        let symbols = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', uri);
        return c2pExt.asSymbolInformations(symbols, uri);
    });
    connection.onRequest(vscodeLSP.WorkspaceSymbolRequest.type, async (params) => {
        let symbols = await vscode.commands.executeCommand('vscode.executeWorkspaceSymbolProvider', params.query);
        return c2pExt.asSymbolInformations(symbols, undefined);
    });
    connection.onRequest(vscodeLSP.CodeActionRequest.type, async (params) => {
        if (clientAccessCheck &&
            !await clientAccessCheck().canPerformOperation(params, codeActionOperation)) {
            return undefined;
        }
        let uri = p2c.asUri(params.textDocument.uri);
        let range = p2c.asRange(params.range);
        let commandsOrCodeActions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', uri, range);
        if (!commandsOrCodeActions) {
            return undefined;
        }
        return commandsOrCodeActions.map(commandOrCodeAction => typeof commandOrCodeAction.command === 'string' ?
            commandHandler.wrapCommand(commandOrCodeAction, c2p, c2pExt) :
            c2pExt.asCodeAction(commandOrCodeAction));
    });
    connection.onRequest(vscodeLSP.ExecuteCommandRequest.type, async (params) => {
        if (clientAccessCheck &&
            !await clientAccessCheck().canPerformOperation(params, codeActionOperation)) {
            return;
        }
        let command;
        let args = params.arguments || [];
        if (params.command.startsWith(exports.REMOTE_COMMAND_NAME)) {
            // Note: this will be typically from a another non-vscode guest that hasn't translated
            // the remote command wrapping
            command = args[0];
            args = command.arguments;
        }
        else {
            command = params;
        }
        if (config.get(config.Key.allowGuestCommandControl) || commandHandler.isSafeCommand(command.command)) {
            await vscode.commands.executeCommand(command.command, ...args);
            return true;
        }
        else {
            // Typescript will return a CodeAction that contains both a WorkspaceEdit and a corresponding Command (that ostensibly does the same thing as the edit).
            // If '_typescript.applyCodeActionCommand' attempted to execute, then the guest would see the WorkspaceEdit applied when running the CodeAction,
            // but then get an error saying the host doesn't allow command execution when the corresponding command attempts to run. This avoids that confusing situation.
            if (command.command === '_typescript.applyCodeActionCommand') {
                return true;
            }
            else {
                return false;
            }
        }
    });
    connection.onRequest(vscodeLSP.DocumentFormattingRequest.type, async (params) => {
        let uri = p2c.asUri(params.textDocument.uri);
        let edits = await vscode.commands.executeCommand('vscode.executeFormatDocumentProvider', uri, params.options);
        if (!edits) {
            return undefined;
        }
        return edits.map(edit => c2p.asTextEdit(edit));
    });
    connection.onRequest(vscodeLSP.DocumentRangeFormattingRequest.type, async (params) => {
        let uri = p2c.asUri(params.textDocument.uri);
        let range = p2c.asRange(params.range);
        let edits = await vscode.commands.executeCommand('vscode.executeFormatRangeProvider', uri, range, params.options);
        if (!edits) {
            return undefined;
        }
        return edits.map(edit => c2p.asTextEdit(edit));
    });
    connection.onRequest(vscodeLSP.DocumentOnTypeFormattingRequest.type, async (params) => {
        let uri = p2c.asUri(params.textDocument.uri);
        let position = p2c.asPosition(params.position);
        let edits = await vscode.commands.executeCommand('vscode.executeFormatOnTypeProvider', uri, position, params.ch, params.options);
        if (!edits) {
            return undefined;
        }
        return edits.map(edit => c2p.asTextEdit(edit));
    });
    connection.onRequest(vscodeLSP.RenameRequest.type, async (params) => {
        let uri = p2c.asUri(params.textDocument.uri);
        let position = p2c.asPosition(params.position);
        let workspaceEdit = await vscode.commands.executeCommand('vscode.executeDocumentRenameProvider', uri, position, params.newName);
        return c2pExt.asWorkspaceEdit(workspaceEdit);
    });
    connection.onRequest(vscodeLSP.DocumentLinkRequest.type, async (params) => {
        let uri = p2c.asUri(params.textDocument.uri);
        let links = await vscode.commands.executeCommand('vscode.executeLinkProvider', uri);
        if (!links) {
            return undefined;
        }
        return links.map(link => c2p.asDocumentLink(link));
    });
    connection.onRequest(vscodeLSP.DocumentColorRequest.type, async (params) => {
        let uri = p2c.asUri(params.textDocument.uri);
        let colors;
        try {
            colors = await vscode.commands.executeCommand('vscode.executeDocumentColorProvider', uri);
        }
        catch (e) { /* color providers is a new feature that may not be supported */ }
        return colors ? colors.map(c => c2pExt.asColorInformation(c)) : colors;
    });
    connection.onRequest(vscodeLSP.ColorPresentationRequest.type, async (params) => {
        let context = {
            uri: p2c.asUri(params.textDocument.uri),
            range: p2c.asRange(params.range)
        };
        let color = new vscode.Color(params.color.red, params.color.green, params.color.blue, params.color.alpha);
        let colorPresentations;
        try {
            colorPresentations = await vscode.commands.executeCommand('vscode.executeColorPresentationProvider', color, context);
        }
        catch (e) { /* color providers is a new feature that may not be supported */ }
        return colorPresentations ? colorPresentations.map(cp => c2pExt.asColorPresentation(cp)) : colorPresentations;
    });
    connection.onRequest(vscodeLSP.CodeLensRequest.type, async (params) => {
        let uri = p2c.asUri(params.textDocument.uri);
        let codeLenses;
        try {
            codeLenses = await vscode.commands.executeCommand('vscode.executeCodeLensProvider', uri, Number.MAX_VALUE);
        }
        catch (e) { /* executeCodeLensProvider is a new feature that may not be supported */ }
        return codeLenses ? codeLenses.map(cl => {
            if (cl.command) {
                cl.command = commandHandler.wrapCommand(cl.command, c2p, c2pExt);
            }
            const result = c2p.asCodeLens(cl);
            // Some returned Code Lenses will contain circular references. This will cause the RPC layer to throw when
            // it attempts to serialize them. This code checks for circular references and removes them if present.
            try {
                JSON.stringify(result);
            }
            catch (e) {
                return JSON.parse(CircularJson.stringify(result));
            }
            return result;
        }) : codeLenses;
    });
}
exports.setupHandlers = setupHandlers;

//# sourceMappingURL=lspServer.js.map
