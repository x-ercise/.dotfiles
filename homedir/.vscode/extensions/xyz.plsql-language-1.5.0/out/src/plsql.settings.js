"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
/**
 * Settings for plsql.
 */
class PLSQLSettings {
    // constructor() {
    // }
    static getSearchInfos(file) {
        // ignore search.exclude settings
        let ignore;
        const searchExclude = vscode.workspace.getConfiguration('search', file).get('exclude');
        if (searchExclude) {
            ignore = Object.keys(searchExclude).filter(key => searchExclude[key]);
        }
        const config = vscode.workspace.getConfiguration('plsql-language');
        // search in specified folder or current workspace
        // const wsFolder = vscode.workspace.getWorkspaceFolder(file);
        // temporary code to resolve bug https://github.com/Microsoft/vscode/issues/36221
        const wsFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(file.fsPath));
        let cwd = wsFolder ? wsFolder.uri.fsPath : '', searchFld = config.get('searchFolder');
        if (searchFld) {
            cwd = searchFld.replace('${workspaceRoot}', cwd) // deprecated
                .replace('${workspaceFolder}', cwd);
        }
        return { ignore, cwd };
    }
    // DEPRECATED...
    // public static getSearchFile(searchText: string): string {
    //     const config = vscode.workspace.getConfiguration('plsql-language');
    //     // fileName = convert packageName
    //     let   fileName = searchText;
    //     const replaceSearch = <string>config.get('replaceSearch');
    //     if (replaceSearch) {
    //         const regExp = new RegExp(replaceSearch, 'i');
    //         fileName = fileName.replace(regExp, <string>config.get('replaceValue') || '');
    //     }
    //     return fileName;
    // }
    static translatePackageName(packageName) {
        const config = vscode.workspace.getConfiguration('plsql-language');
        // packageName using synonym => real packageName
        let name = packageName;
        const synonym = config.get('synonym');
        if (synonym) {
            const regExp = new RegExp(synonym.replace, 'i');
            name = name.replace(regExp, synonym.by || '');
        }
        return name;
    }
    static getCommentInSymbols() {
        const config = vscode.workspace.getConfiguration('plsql-language');
        return config.get('commentInSymbols');
    }
    static getHoverEnable() {
        const config = vscode.workspace.getConfiguration('plsql-language');
        return config.get('hover.enable');
    }
    static getSignatureEnable() {
        const config = vscode.workspace.getConfiguration('plsql-language');
        return config.get('signatureHelp.enable');
    }
    static getSearchExt(searchExt) {
        const config = vscode.workspace.getConfiguration('files'), assoc = config.get('associations');
        let plassoc = [];
        if (assoc) {
            plassoc = Object.keys(assoc)
                .filter(key => assoc[key] === 'plsql')
                .map(item => item.replace(/^\*./, ''));
        }
        return [...new Set([...searchExt, ...plassoc])];
    }
    static getDocInfos(file) {
        const config = vscode.workspace.getConfiguration('plsql-language'), enable = config.get('pldoc.enable'), author = config.get('pldoc.author');
        let location = config.get('pldoc.path');
        if (!location)
            location = path.join(__dirname, '../../snippets/pldoc.json');
        else {
            // const wsFolder = vscode.workspace.getWorkspaceFolder(file);
            // temporary code to resolve bug https://github.com/Microsoft/vscode/issues/36221
            const wsFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(file.fsPath));
            const cwd = wsFolder ? wsFolder.uri.fsPath : '';
            location = location.replace('${workspaceRoot}', cwd); // deprecated
            location = location.replace('${workspaceFolder}', cwd);
            location = path.join(location, 'pldoc.json');
        }
        return { enable, author, location };
    }
    static getCompletionPath(wsFolder) {
        const config = vscode.workspace.getConfiguration('plsql-language');
        let location = config.get('completion.path');
        if (location) {
            const cwd = wsFolder ? wsFolder.fsPath : '';
            // location = location.replace('${workspaceRoot}', cwd); // deprecated
            location = location.replace('${workspaceFolder}', cwd);
            if (location)
                location = path.join(location, 'plsql.completion.json');
        }
        return location;
    }
    // global config
    static getConnections() {
        const config = vscode.workspace.getConfiguration('plsql-language');
        return config.get('connections');
    }
    static getConnectionPattern() {
        const config = vscode.workspace.getConfiguration('plsql-language');
        return {
            patternName: config.get('connection.patternName'),
            patternActiveInfos: config.get('connection.patternActiveInfos')
        };
    }
}
exports.PLSQLSettings = PLSQLSettings;
//# sourceMappingURL=plsql.settings.js.map