//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const code = require("vscode");
const proto = require("vscode-languageserver-protocol");
const util_1 = require("util");
const commandHandler_1 = require("./commandHandler");
function createConverterExtension(converter) {
    function asHover(value) {
        if (value === void 0 || value === null) {
            return null;
        }
        return {
            range: converter.asRange(value.range),
            contents: value.contents.map((c, index) => asHoverContent(c, index > 0))
        };
    }
    function asHoverContent(item, prependNewLine) {
        // A code.MarkedString is a proto.MarkedString | code.MarkdownString. Handle the case where it's a MarkdownString.
        // Also, the vscode-languageclient library converts the protocol messages to code.Hover and if gets an array of markdown strings,
        // it doesn't prepend a newline between making the hover look incorrect. Fixing that up here.
        if (isMarkdownString(item)) {
            return prependNewLine ? `\n${item.value}` : item.value;
        }
        else if (util_1.isString(item)) {
            return prependNewLine ? `\n${item}` : item;
        }
        else {
            return item;
        }
    }
    function asDefinitionResult(item) {
        if (!item) {
            return undefined;
        }
        if (Array.isArray(item)) {
            return item.map((location) => asLocation(location));
        }
        else {
            return asLocation(item);
        }
    }
    function asLocation(item) {
        if (!item) {
            return undefined;
        }
        return proto.Location.create(converter.asUri(item.uri), converter.asRange(item.range));
    }
    function asReferences(values) {
        if (!values) {
            return undefined;
        }
        return values.map(location => asLocation(location));
    }
    function asDocumentHighlights(values) {
        if (!values) {
            return undefined;
        }
        return values.map(asDocumentHighlight);
    }
    function asDocumentHighlight(item) {
        let result = proto.DocumentHighlight.create(converter.asRange(item.range));
        if (isNumber(item.kind)) {
            result.kind = asDocumentHighlightKind(item.kind);
        }
        return result;
    }
    function asDocumentHighlightKind(item) {
        switch (item) {
            case code.DocumentHighlightKind.Text:
                return proto.DocumentHighlightKind.Text;
            case code.DocumentHighlightKind.Read:
                return proto.DocumentHighlightKind.Read;
            case code.DocumentHighlightKind.Write:
                return proto.DocumentHighlightKind.Write;
            default:
                return proto.DocumentHighlightKind.Text;
        }
    }
    function asSymbolInformations(values, uri) {
        if (!values) {
            return undefined;
        }
        return values.map(symbol => asSymbolInformation(symbol, uri));
    }
    function asSymbolInformation(item, uri) {
        // VS Code broke the symbol information API around Insiders 1.25.0, and now requesting symbols returns
        // a list of vs/editor/common/modes.DocumentSymbol instead of code.SymbolInformation. Account for this case for people on newer version of VS Code.
        const range = item.location ? item.location.range : item.range;
        const itemUri = item.location ? item.location.uri : uri;
        // Symbol kind is one based in the protocol and zero based in code.
        let result = proto.SymbolInformation.create(item.name, item.kind + 1, converter.asRange(range), converter.asUri(itemUri));
        if (item.containerName) {
            result.containerName = item.containerName;
        }
        return result;
    }
    function asSignatureHelp(item) {
        if (!item) {
            return undefined;
        }
        let activeSignature;
        let activeParameter;
        let signatures = [];
        if (isNumber(item.activeSignature)) {
            activeSignature = item.activeSignature;
        }
        else {
            // activeSignature was optional in the past
            activeSignature = 0;
        }
        if (isNumber(item.activeParameter)) {
            activeParameter = item.activeParameter;
        }
        else {
            // activeParameter was optional in the past
            activeParameter = 0;
        }
        if (item.signatures) {
            signatures = asSignatureInformations(item.signatures);
        }
        return { activeSignature, activeParameter, signatures };
    }
    function asSignatureInformations(items) {
        return items.map(asSignatureInformation);
    }
    function asSignatureInformation(item) {
        let result = proto.SignatureInformation.create(item.label);
        if (item.documentation) {
            result.documentation = item.documentation.toString();
        }
        if (item.parameters) {
            result.parameters = asParameterInformations(item.parameters);
        }
        return result;
    }
    function asParameterInformations(item) {
        return item.map(asParameterInformation);
    }
    function asParameterInformation(item) {
        let result = proto.ParameterInformation.create(item.label);
        if (item.documentation) {
            result.documentation = item.documentation.toString();
        }
        return result;
    }
    function asWorkspaceEdit(item) {
        if (!item) {
            return undefined;
        }
        let changes = {};
        item.entries().forEach(c => {
            changes[converter.asUri(c['0'])] = c['1'].map(edit => converter.asTextEdit(edit));
        });
        return { changes: changes };
    }
    function asColorInformation(item) {
        let colorInfo = {
            color: item.color,
            range: converter.asRange(item.range)
        };
        return colorInfo;
    }
    function asColorPresentation(item) {
        let colorPresentation = {
            label: item.label,
            textEdit: converter.asTextEdit(item.textEdit)
        };
        if (item.additionalTextEdits) {
            colorPresentation.additionalTextEdits = item.additionalTextEdits.map(edit => converter.asTextEdit(edit));
        }
        return colorPresentation;
    }
    function asCodeAction(item) {
        let codeAction;
        let kind = item.kind ? item.kind.value : undefined;
        let command = item.command ? commandHandler_1.wrapCommand(item.command, converter, this) : undefined;
        if (item.edit) {
            codeAction = proto.CodeAction.create(item.title, asWorkspaceEdit(item.edit), kind);
            // A CodeAction can contain both an edit and a command. If both are supplied, the edit is applied first,
            // then the command is executed.
            if (command) {
                codeAction.command = command;
            }
        }
        else if (command) {
            codeAction = proto.CodeAction.create(item.title, command, kind);
        }
        else {
            throw new Error('Invalid CodeAction - neither command nor edit.');
        }
        if (item.diagnostics) {
            codeAction.diagnostics = converter.asDiagnostics(item.diagnostics);
        }
        return codeAction;
    }
    return {
        asHover,
        asDefinitionResult,
        asLocation,
        asReferences,
        asDocumentHighlights,
        asSymbolInformations,
        asSignatureHelp,
        asWorkspaceEdit,
        asColorInformation,
        asColorPresentation,
        asCodeAction
    };
}
exports.createConverterExtension = createConverterExtension;
function isNumber(value) {
    return Object.prototype.toString.call(value) === '[object Number]';
}
function isMarkdownString(item) {
    return item.value !== undefined;
}

//# sourceMappingURL=code2protocolExtension.js.map
