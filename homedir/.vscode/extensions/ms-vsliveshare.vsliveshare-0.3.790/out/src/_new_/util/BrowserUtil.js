"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
/**
 * Helper functions for working with the browser.
 */
class BrowserUtil {
    openBrowser(uri) {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(uri));
    }
}
exports.BrowserUtil = BrowserUtil;

//# sourceMappingURL=BrowserUtil.js.map
