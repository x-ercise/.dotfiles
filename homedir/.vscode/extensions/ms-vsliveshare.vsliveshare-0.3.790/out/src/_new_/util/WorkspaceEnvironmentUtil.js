"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const config = require("../../config");
const util_1 = require("../../util");
/**
 * Helper functions for working with VS Code workspaces.
 */
class WorkspaceEnvironmentUtil {
    getAllRootFileSystemPaths() {
        if (!config.featureFlags.multiRootWorkspaceVSCode) {
            return [util_1.PathUtil.getPrimaryWorkspaceFileSystemPath()];
        }
        return vscode.workspace.workspaceFolders.map((folder) => folder.uri.fsPath);
    }
}
exports.WorkspaceEnvironmentUtil = WorkspaceEnvironmentUtil;

//# sourceMappingURL=WorkspaceEnvironmentUtil.js.map
