"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const fs = require("fs");
const json5 = require("json5");
const plsql_settings_1 = require("./plsql.settings");
/**
 * Controller for handling PLSQLCompletionCustom
 */
class PLSQLCompletionCustom {
    constructor() {
        this.plsqlCompletionDefs = [];
    }
    getCompletion(document, text) {
        const completion = this.init(document.uri);
        if (completion)
            if (text)
                return completion.members[text.toLowerCase()];
            else
                return completion.objects;
    }
    init(file) {
        // Find workspaceFolder corresponding to file
        let folder;
        // const wsFolder = vscode.workspace.getWorkspaceFolder(file);
        // temporary code to resolve bug https://github.com/Microsoft/vscode/issues/36221
        const wsFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(file.fsPath));
        if (wsFolder)
            folder = wsFolder.uri;
        let completionDefs = this.plsqlCompletionDefs.find((value, index, obj) => {
            if (folder && value.folder)
                return (value.folder.fsPath === folder.fsPath);
            else
                return (folder === value.folder);
        });
        if (!completionDefs) {
            completionDefs = this.readJSONFile(folder);
            if (completionDefs)
                this.plsqlCompletionDefs.push(completionDefs);
            else
                this.plsqlCompletionDefs.push({ folder: folder, members: {} });
        }
        return completionDefs;
    }
    readJSONFile(workspacefolder) {
        const location = plsql_settings_1.PLSQLSettings.getCompletionPath(workspacefolder);
        if (!location)
            return;
        let parsedJSON;
        try {
            parsedJSON = json5.parse(fs.readFileSync(location).toString()); // invalid JSON or permission issue can happen here
        }
        catch (error) {
            console.error(error);
            return;
        }
        const members = {};
        const objects = [];
        Object.keys(parsedJSON).forEach(item => {
            if (parsedJSON[item].members)
                members[item.toLowerCase()] = parsedJSON[item].members.map(member => ({ label: member.label, kind: this.convertToCompletionKind(member.kind), documentation: member.documentation }));
            objects.push({ label: item, kind: this.convertToCompletionKind(parsedJSON[item].kind), documentation: parsedJSON[item].documentation });
        });
        return {
            folder: workspacefolder,
            objects: objects,
            members: members
        };
    }
    convertToCompletionKind(kind) {
        if (kind)
            kind = kind.toLowerCase();
        switch (kind) {
            case 'class': return vscode.CompletionItemKind.Class;
            case 'color': return vscode.CompletionItemKind.Color;
            case 'constant': return vscode.CompletionItemKind.Constant;
            case 'constructor': return vscode.CompletionItemKind.Constructor;
            case 'enum': return vscode.CompletionItemKind.Enum;
            case 'enumMember': return vscode.CompletionItemKind.EnumMember;
            case 'event': return vscode.CompletionItemKind.Event;
            case 'field': return vscode.CompletionItemKind.Field;
            case 'file': return vscode.CompletionItemKind.File;
            case 'folder': return vscode.CompletionItemKind.Folder;
            case 'function': return vscode.CompletionItemKind.Function;
            case 'interface': return vscode.CompletionItemKind.Interface;
            case 'keyword': return vscode.CompletionItemKind.Keyword;
            case 'method': return vscode.CompletionItemKind.Method;
            case 'module': return vscode.CompletionItemKind.Module;
            case 'operator': return vscode.CompletionItemKind.Operator;
            case 'property': return vscode.CompletionItemKind.Property;
            case 'reference': return vscode.CompletionItemKind.Reference;
            case 'snippet': return vscode.CompletionItemKind.Snippet;
            case 'struct': return vscode.CompletionItemKind.Struct;
            case 'text': return vscode.CompletionItemKind.Text;
            case 'typeParameter': return vscode.CompletionItemKind.TypeParameter;
            case 'unit': return vscode.CompletionItemKind.Unit;
            case 'value': return vscode.CompletionItemKind.Value;
            case 'variable': return vscode.CompletionItemKind.Variable;
            default: return vscode.CompletionItemKind.Text;
        }
    }
}
exports.default = PLSQLCompletionCustom;
//# sourceMappingURL=plsqlCompletionCustom.js.map