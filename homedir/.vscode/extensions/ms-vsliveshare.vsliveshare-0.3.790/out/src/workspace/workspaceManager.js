"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const util_1 = require("../util");
/**
 * This class is serialized to JSON and written
 * to the workspace file.
 * {"folders": [{"uri": "vsls:/"}], "settings": {} }
 */
class WorkspaceDefinition {
    constructor() {
        this.folders = [];
        this.settings = {};
    }
}
exports.WorkspaceDefinition = WorkspaceDefinition;
class WorkspaceManager {
    /**
     * Creates a new workspace file in a temporary folder.
     *
     * @param workspaceFilePath Path to the workspace file.
     * @param workspaceDefinition the workspace definition (contents of the workspace file)
     */
    static async createWorkspace(workspaceFilePath, workspaceDefinition) {
        return new Promise((resolve, reject) => {
            const workspaceFileContent = JSON.stringify(workspaceDefinition);
            if (fs.existsSync(workspaceFilePath)) {
                return resolve(workspaceFilePath);
            }
            try {
                util_1.ExtensionUtil.writeFile(workspaceFilePath, workspaceFileContent)
                    .then(() => { resolve(workspaceFilePath); });
            }
            catch (e) {
                reject(e);
            }
        });
    }
    static async updateWorkspaceFile(workspaceDefinition, workspacePath) {
        const workspaceFileContent = JSON.stringify(workspaceDefinition);
        return util_1.ExtensionUtil.writeFile(workspacePath, workspaceFileContent);
    }
}
exports.WorkspaceManager = WorkspaceManager;

//# sourceMappingURL=workspaceManager.js.map
