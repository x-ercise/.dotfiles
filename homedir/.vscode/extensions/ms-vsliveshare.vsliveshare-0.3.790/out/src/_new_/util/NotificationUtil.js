"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const util_1 = require("../../util");
/**
 * Helper functions for working with VS Code Notifications/toasts.
 */
class NotificationUtil {
    showInformationMessage(message, ...items) {
        return vscode.window.showInformationMessage(message, ...items);
    }
    // TODO: normalize with VSCode options better
    showErrorMessage(message) {
        return util_1.ExtensionUtil.showErrorAsync(message);
    }
    showInputBox(options, token) {
        return vscode.window.showInputBox(options, token);
    }
    showQuickPick(items, options, token) {
        return vscode.window.showQuickPick(items, options, token);
    }
    withProgress(options, task, token) {
        // TODO: playing with the signatures here due to version difference
        return vscode.window.withProgress(options, task);
    }
}
exports.NotificationUtil = NotificationUtil;

//# sourceMappingURL=NotificationUtil.js.map
