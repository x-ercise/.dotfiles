'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const config = require("../config");
const traceSource_1 = require("../tracing/traceSource");
/**
 * Settings that are used during LiveShare collab sessions, to set on the workspace file.
 */
const baseWorkspaceSettings = {
    // Don't show extension recommendations to guests, since
    // we're trying to avoid them having to install them
    'extensions.ignoreRecommendations': true,
    // Always detect the indentation from the file, as a best-guess for
    // ensuring existing code formatting rule is followed. True is the default
    // in vscode, this is to ensure that others turning it off, get it back on
    'editor.detectIndentation': true,
    // Since formatting policy is driven entirely by the host, make sure that 
    // the decision of when to format is also driven by the host.
    'editor.formatOnSave': false,
    // Don't persist our state if closed, so they get a blank IDE rather than
    // trying to reconnect to a session days later
    'files.hotExit': 'off',
    // Make sure the guest isn't sending periodic save requests. The host will
    // have their settings apply, but the guest won't be randomly saving files.
    // However, the human guest can still press save.
    'files.autoSave': 'off',
    // Disable the guest from automatically updating code contents as typing
    // happens. These settings, if set on the host, will still be applied. This
    // ensures that the guests don't have conflicting settings
    'files.trimTrailingWhitespace': false,
    'files.insertFinalNewline': false,
    'files.trimFinalNewlines': false,
    // disable task auto-detect for built-in providers
    'typescript.tsc.autoDetect': 'off',
    'jake.autoDetect': 'off',
    'grunt.autoDetect': 'off',
    'gulp.autoDetect': 'off',
    'npm.autoDetect': 'off',
    // This setting allows guests to set breakpoints in any file within the workspace they
    // are joining, without requiring them to install the respective language extensions.
    'debug.allowBreakpointsEverywhere': true,
    // This setting ensures that the guests build-in HTML auto-closing logic
    // doesn't run, since it will already run on the host-side
    'html.autoClosingTags': false,
};
let pendingFolderUpdates;
function beginFolderUpdate() {
    if (!pendingFolderUpdates) {
        pendingFolderUpdates = new Promise((resolve) => {
            const handler = vscode.workspace.onDidChangeWorkspaceFolders((e) => {
                handler.dispose();
                pendingFolderUpdates = null;
                resolve();
            });
        });
    }
    return pendingFolderUpdates;
}
function waitForPendingFolderUpdatesToFinish() {
    if (pendingFolderUpdates) {
        return pendingFolderUpdates;
    }
    return Promise.resolve();
}
async function ensureWorkspaceName(workspaceSessionInfo) {
    if (!workspaceSessionInfo || (vscode.workspace.workspaceFolders[0].name === workspaceSessionInfo.name)) {
        return;
    }
    // Add all folders in one operation rather than individually for
    // the best experience. However, when doing this you can't
    // perform any more update folder operations till this one
    // completes, hence ensuring the name waiting for the event.
    await waitForPendingFolderUpdatesToFinish();
    beginFolderUpdate();
    // update workspace name
    vscode.workspace.updateWorkspaceFolders(0, 1, {
        uri: vscode.workspace.workspaceFolders[0].uri,
        name: workspaceSessionInfo.name
    });
}
class JoinUtilities {
    static addAdditionalRootsFromFileServiceToWorkspace(fileService, workspaceSessionInfo) {
        // Start the folder update. Note, we don't want to _wait_ for these
        // folders to complete, nor for the list roots call to complete befpre
        // returning. So we start them and handle them in a promise after.
        ensureWorkspaceName(workspaceSessionInfo);
        // Becuase only one folder change can be inflight at a time, but we don't
        // want to wait to start the call to the list roots, so also start that
        // and then wait on _all_ of them to process them.
        const workspaceNameUpdate = waitForPendingFolderUpdatesToFinish();
        let listRoots = Promise.resolve([]);
        if (config.featureFlags.multiRootWorkspaceVSCode) {
            // If multitroots are only, actually do the call instead of
            // completing with an empty array.
            listRoots = fileService.listRootsAsync({ enableMultipleRoots: true });
        }
        Promise.all([workspaceNameUpdate, listRoots]).then(async (result) => {
            // second result from promise all contains the listed roots, if any
            let roots = result[1];
            if (roots.length < 2) {
                ensureWorkspaceName(workspaceSessionInfo);
                return;
            }
            // We already added the first root (it's what we opened
            // with), so we only need the other roots.
            roots = roots.slice(1);
            // Convert the paths into URIs
            const workspaceFolders = roots.map((root, index) => {
                return {
                    uri: vscode.Uri.parse(`${config.get(config.Key.scheme)}:${root.path}`),
                    name: root.friendlyName || `Workspace ${index + 1}`,
                };
            });
            await waitForPendingFolderUpdatesToFinish();
            beginFolderUpdate();
            ensureWorkspaceName(workspaceSessionInfo);
            const didAddFolders = vscode.workspace.updateWorkspaceFolders(1, 0, ...workspaceFolders);
            if (!didAddFolders) {
                traceSource_1.traceSource.error('Unable to add non-primary workspace folders');
            }
        });
    }
    /**
     * Function to restore LiveShare workspace without a reload.
     * @param workspaceid Workspace id string.
     * @param workspaceName Worksapce name string, if present.
     * @returns void
     */
    static async restoreLiveshareWorkspaceState(workspaceid, workspaceName = 'Loading file tree...') {
        const settings = vscode.workspace.getConfiguration();
        await settings.update('vsliveshare.join.reload.workspaceId', workspaceid, vscode.ConfigurationTarget.Workspace);
        await JoinUtilities.applyGuestSettingsToWorkspace();
        let primaryWorkspaceRoot = `${config.get(config.Key.scheme)}:/`;
        await waitForPendingFolderUpdatesToFinish();
        beginFolderUpdate();
        const didAddFolder = vscode.workspace.updateWorkspaceFolders(0, null, {
            uri: vscode.Uri.parse(primaryWorkspaceRoot),
            name: workspaceName
        });
        return;
    }
    static async applyGuestSettingsToWorkspace() {
        const settings = vscode.workspace.getConfiguration();
        for (let settingName of Object.keys(baseWorkspaceSettings)) {
            try {
                await settings.update(settingName, baseWorkspaceSettings[settingName], vscode.ConfigurationTarget.Workspace);
            }
            catch (e) {
                traceSource_1.traceSource.info(`[applying guest workspace settings]: Failed to set the "${settingName}" setting on the workspace.`);
            }
        }
    }
    /**
     * Function to checfk if the VSCode instance loaded in context of LiveShare workspace that does not have folders.
     * @param workspace VSCode workspace to check on.
     * @returns boolean Whether the workspace is LiveShare workspace with no folders.
     */
    static isBrokenLiveshareWorkspaceFile(workspace) {
        const isNameMatch = (workspace.name === 'Visual Studio Live Share (Workspace)');
        return isNameMatch && JoinUtilities.isEmptyWorkspace(workspace);
    }
    static isEmptyWorkspace(workspace) {
        return !workspace.workspaceFolders || (workspace.workspaceFolders.length === 0);
    }
    static getBaseWorkspaceSettings() {
        return Object.assign({}, baseWorkspaceSettings);
    }
}
exports.JoinUtilities = JoinUtilities;

//# sourceMappingURL=joinUtilities.js.map
