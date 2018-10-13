"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const uuid = require("uuid");
class WelcomePageHTMLProvider {
    constructor() {
        this.onDidChangeInternal = new vscode.EventEmitter();
        this.onDidChange = this.onDidChangeInternal.event;
    }
    update(uri) {
        this.onDidChangeInternal.fire(uri);
    }
    provideTextDocumentContent(uri) {
        const extensionDir = path.resolve(__dirname, '../../');
        const welcomePageDir = path.join(extensionDir, 'src/welcomePage');
        const mainScriptPath = vscode.Uri.file(path.join(welcomePageDir, 'welcomePageMain.js'));
        const stylePath = vscode.Uri.file(path.join(welcomePageDir, 'welcomePage.css'));
        let contents = fs.readFileSync(path.join(welcomePageDir, 'welcomePage.html')).toString();
        // Create a nonce to whitelist which scripts & styles can be run
        const nonce = this.getNonce();
        const initializeScriptBlock = `<script nonce="${nonce}">const isSharing=${this.joinUri !== null}; const isWebView=${this.isWebview};</script>`;
        if (this.isWebview) {
            const mainScriptUri = mainScriptPath.with({ scheme: 'vscode-resource' });
            const styleUri = stylePath.with({ scheme: 'vscode-resource' });
            contents = contents.replace('${mainScriptUri}', mainScriptUri.toString())
                .replace('${styleUri}', styleUri.toString());
        }
        else {
            // For HTML preview embed the script & styles in the page
            const mainScriptContents = fs.readFileSync(mainScriptPath.fsPath);
            const styleContents = fs.readFileSync(stylePath.fsPath);
            contents = contents.replace('<script nonce="${nonce}" src="${mainScriptUri}"></script>', `<script nonce="${nonce}">${mainScriptContents}</script>`)
                .replace('<link rel="stylesheet" href="${styleUri}" nonce="${nonce}">', `<style nonce="${nonce}">${styleContents}</style>`);
        }
        return contents.replace(/\$\{this.joinUri\}/g, this.joinUri)
            .replace('<script nonce="${nonce}"></script>', initializeScriptBlock)
            .replace(/\$\{nonce\}/g, nonce);
    }
    getNonce() {
        return uuid().replace(/-/g, '');
    }
}
exports.default = WelcomePageHTMLProvider;

//# sourceMappingURL=welcomePageHTMLProvider.js.map
