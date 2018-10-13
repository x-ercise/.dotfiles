//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const semver = require("semver");
const vscode = require("vscode");
const config = require("../config");
const util_1 = require("../util");
const workspaceProvider2_1 = require("./workspaceProvider2");
const workspaceProvider_1 = require("./workspaceProvider");
class FileSystemManager {
    constructor(workspaceService, fileService) {
        this.workspaceService = workspaceService;
        this.fileService = fileService;
    }
    get workspaceProvider() {
        return this.provider;
    }
    registerFileSystemProvider(isReadOnly = false) {
        const isVersion123 = semver.gte(semver.coerce(vscode.version), '1.23.0');
        const deprecatedApiAvailable = !!vscode.workspace.registerDeprecatedFileSystemProvider;
        const isNewFileProviderEnabled = config.featureFlags.newFileProvider || !deprecatedApiAvailable;
        if (this.fileSystemProvider) {
            // There is already a file system provider registered, do not change it if
            // the read-only option has not changed or vscode doesn't support it.
            // Refresh file explorer anyway.
            if (isReadOnly === this.isFileSystemProviderReadOnly || !isVersion123 || !isNewFileProviderEnabled) {
                return;
            }
            this.dispose();
        }
        else {
            // This is the first time we register the file system provider.
            // Add disposable to the extension context to dispose of it later.
            util_1.ExtensionUtil.Context.subscriptions.push(this);
        }
        if (isVersion123) {
            if (isNewFileProviderEnabled) {
                // version >= 1.23.0, using new API if feature flag enabled
                if (!this.provider) {
                    this.provider = new workspaceProvider2_1.WorkspaceProvider(this.workspaceService, this.fileService);
                }
                this.fileSystemProvider = vscode.workspace.registerFileSystemProvider(config.get(config.Key.authority), this.workspaceProvider, { isCaseSensitive: true, isReadonly: isReadOnly || false });
            }
            else {
                // version >= 1.23.0, using deprecated API
                const deprecatedWorkspaceProvider = new workspaceProvider_1.DeprecatedWorkspaceProvider(this.workspaceService, this.fileService);
                this.fileSystemProvider = vscode.workspace.registerDeprecatedFileSystemProvider(config.get(config.Key.authority), deprecatedWorkspaceProvider);
            }
        }
        else {
            // version < 1.23.0, using proposed API
            const deprecatedWorkspaceProvider = new workspaceProvider_1.DeprecatedWorkspaceProvider(this.workspaceService, this.fileService);
            this.fileSystemProvider = vscode.workspace.registerFileSystemProvider(config.get(config.Key.authority), deprecatedWorkspaceProvider, undefined);
        }
        this.isFileSystemProviderReadOnly = isReadOnly;
    }
    disposeWorkspaceProvider() {
        if (this.provider) {
            this.provider.dispose();
            this.provider = null;
        }
    }
    dispose() {
        if (this.fileSystemProvider) {
            this.fileSystemProvider.dispose();
            this.fileSystemProvider = null;
        }
        this.disposeWorkspaceProvider();
    }
}
exports.FileSystemManager = FileSystemManager;

//# sourceMappingURL=fileSystemManager.js.map
