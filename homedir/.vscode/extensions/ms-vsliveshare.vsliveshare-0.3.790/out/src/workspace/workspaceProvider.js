//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const buffer = require("buffer");
const traceSource_1 = require("../tracing/traceSource");
const vsls = require("../contracts/VSLS");
const url = require("url");
const session_1 = require("../session");
const sessionTypes_1 = require("../sessionTypes");
const config = require("../config");
const util_1 = require("../util");
const workspaceProvider2_1 = require("./workspaceProvider2");
/**
 * This file system provider has been deprecated and is only used for people on old versions of VSCode.
 * Please remove the "onFileSystemAccess:vsls" activation event from package.json whenever this code is deleted.
 */
class DeprecatedWorkspaceProvider {
    constructor(workspaceService, fileService) {
        this.workspaceService = workspaceService;
        this.fileService = fileService;
        this.onFilesChangedEmitter = new vscode.EventEmitter();
        this.eventRegistrations = [];
        this.isDisposed = false;
        this.multiRootWorkspaceEnabled = config.featureFlags.multiRootWorkspaceVSCode;
        this.uriPrefix = config.get(config.Key.scheme) + ':';
        // FileSystemProvider members
        this.onDidChange = this.onFilesChangedEmitter.event;
        this.getFileStat = (fileInfo, id) => {
            let fileStat = {
                id: id,
                mtime: fileInfo.mtime ? Date.parse(fileInfo.mtime) : 0,
                size: fileInfo.size ? fileInfo.size : 0,
                type: fileInfo.isDirectory ? 1 /* vscode.FileType.Dir */ : 0 /* vscode.FileType.File */
            };
            return fileStat;
        };
        this.trace = traceSource_1.traceSource.withName(traceSource_1.TraceSources.ClientFileProvider);
        this.workspaceService.onConnectionStatusChanged(this.onWorkspaceConnectionStatusChanged, this, this.eventRegistrations);
        this.fileService.onFilesChanged(this.onFilesChanged, this, this.eventRegistrations);
    }
    onWorkspaceConnectionStatusChanged(e) {
        this.currentConnectionStatus = e.connectionStatus;
    }
    onFilesChanged(e) {
        const changes = e.changes.map(change => {
            const changePath = util_1.PathUtil.getRelativePathFromPrefixedPath(change.fullPath);
            const changeUri = vscode.Uri.parse(`${this.uriPrefix}${changePath}`);
            const fileChange = {
                type: DeprecatedWorkspaceProvider.toFileChangeType(change.changeType),
                resource: changeUri,
            };
            return fileChange;
        });
        this.onFilesChangedEmitter.fire(changes);
    }
    static toFileChangeType(changeType) {
        switch (changeType) {
            case vsls.FileChangeType.Added:
                return 1; /* vscode.DeprecatedFileChangeType.Added */
            case vsls.FileChangeType.Deleted:
                return 2; /* vscode.DeprecatedFileChangeType.Deleted */
            case vsls.FileChangeType.Updated:
                return 0; /* vscode.FileChangeType.Updated */
            default: throw new Error('changeType not supported');
        }
    }
    dispose() {
        this.isDisposed = true;
        this.eventRegistrations.forEach((r) => r.dispose());
    }
    async utimes(resource, mtime, atime) {
        return Promise.resolve(undefined);
    }
    async stat(resource) {
        if (!this.isSessionActive) {
            return this.getDefaultFileStat(resource);
        }
        if (resource.path === '/' || resource.path === '') {
            return Promise.resolve({
                type: 1,
                id: resource.toString(),
                mtime: 0,
                size: 0
            });
        }
        let fileListOptions = {
            recurseMode: vsls.FileRecurseMode.None,
            excludePatterns: undefined,
            includeDetails: true,
            enableMultipleRoots: this.multiRootWorkspaceEnabled
        };
        let paths = [];
        paths.push(resource.path);
        return this.fileService.listAsync(paths, fileListOptions)
            .then((fileInfo) => {
            return this.getFileStat(fileInfo[0], resource.toString());
        });
    }
    async read(resource, offset = 0, length, progress) {
        if (!this.isSessionActive || !resource.path.length) {
            return 0;
        }
        let fileTextInfo;
        try {
            fileTextInfo = await this.fileService.readTextAsync(resource.path, {});
        }
        catch (e) {
            // throw a friendlier error
            throw new Error('Please wait to open workspace files until the collaboration session is joined.');
        }
        if (fileTextInfo.exists === false) {
            // It's possible the file was deleted or excluded since the last directory-list call
            // and the change notification hasn't been processed yet.
            // TODO: Throw a specific Error in this case after VS Code supports error-handling
            // for FS provider calls. See related VS Code issue:
            // https://github.com/Microsoft/vscode/issues/47475
            // For now, just pretend the file is empty.
            return 0;
        }
        // The file we received from the file service is not guaranteed to be completely synchronized with coauthoring.
        // Wait for the coauthoring client to fully synchronize it.
        let result = fileTextInfo.text;
        const coAuthoringFileName = session_1.SessionContext.coeditingClient.uriToFileName(resource);
        if (coAuthoringFileName) {
            result = await session_1.SessionContext.coeditingClient.performFileOpenHandshake(coAuthoringFileName, result);
            if (typeof result === 'boolean' && result === false) {
                let binaryBuffer = workspaceProvider2_1.getBinaryPreamble();
                progress.report(binaryBuffer);
                return binaryBuffer.length;
            }
        }
        let fileBuffer = buffer.Buffer.from(result, 'utf8');
        if (offset >= fileBuffer.length) {
            return 0;
        }
        else {
            // length is -1 if the IDE needs the whole file, so only handle positive lengths
            let actualBuffer = fileBuffer.subarray(offset, length > 0 ? offset + length : undefined);
            progress.report(actualBuffer);
            return actualBuffer.length;
        }
    }
    async write(resource, content) {
        if (!this.isSessionActive) {
            return;
        }
        try {
            // First check if the file exists
            const exists = await this.fileExists(resource);
            if (exists) {
                // The co-editing client takes care of sending a save request to the owner, so there is nothing to do here.
                return;
            }
            // The participant is creating a new file
            const stringContent = content.toString();
            const writeResult = await this.fileService.writeTextAsync(resource.path, stringContent, { append: false, createIfNotExist: true });
            if (writeResult.exists === false) {
                // The file service did not allow creating the file, possibly because it's in an excluded path.
                // Delete the file from the tree view.
                this.onFilesChangedEmitter.fire([{ resource, type: vscode.DeprecatedFileChangeType.Deleted }]);
            }
        }
        catch (e) {
            // To prevent dirty files and the "Save before closing?" dialog, report a save success.
            this.trace.error(e.message);
            return;
        }
    }
    async move(resource, target) {
        if (!this.isSessionActive) {
            return this.getDefaultFileStat(target);
        }
        let fileInfo = await this.fileService.moveAsync(resource.path, url.parse(target.path).path, { overwrite: false });
        vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
        return this.getFileStat(fileInfo, target.toString());
    }
    async mkdir(resource) {
        if (!this.isSessionActive) {
            return this.getDefaultFileStat(resource);
        }
        let createResult = await this.fileService.createDirectoryAsync(resource.path);
        if (createResult.exists === false) {
            // The file service did not allow creating the directory, possibly because it's in an excluded path.
            // Delete the directory from the tree view.
            this.onFilesChangedEmitter.fire([{ resource, type: vscode.DeprecatedFileChangeType.Deleted }]);
        }
        return this.getFileStat(createResult, resource.toString());
    }
    async readdir(resource) {
        const result = [];
        if (!this.isSessionActive) {
            return result;
        }
        let fileListOptions = {
            recurseMode: vsls.FileRecurseMode.Children,
            excludePatterns: undefined,
            includeDetails: true,
            enableMultipleRoots: this.multiRootWorkspaceEnabled
        };
        let fileInfo;
        fileInfo = await this.fileService.listAsync([resource.path], fileListOptions);
        fileInfo = fileInfo[0].children;
        if (fileInfo) {
            fileInfo.forEach(fi => {
                let uri = resource.with({ path: fi.path });
                let fileStat = this.getFileStat(fi, uri.toString());
                result.push([uri, fileStat]);
            });
        }
        return result;
    }
    rmdir(resource) {
        if (!this.isSessionActive) {
            return Promise.resolve(void 0);
        }
        return this.fileService.deleteAsync(resource.path, { useTrash: true });
    }
    unlink(resource) {
        if (!this.isSessionActive) {
            return Promise.resolve(void 0);
        }
        return this.fileService.deleteAsync(resource.path, { useTrash: true });
    }
    get isSessionActive() {
        const isJoined = (session_1.SessionContext.State === sessionTypes_1.SessionState.Joined);
        const isConnected = (this.currentConnectionStatus !== vsls.WorkspaceConnectionStatus.Disconnected);
        return isJoined && isConnected && !this.isDisposed;
    }
    getDefaultFileStat(resource) {
        return Promise.resolve({
            type: 1 /* vscode.FileType.Dir */,
            id: resource.toString(),
            mtime: 0,
            size: 0
        });
    }
    fileExists(resource) {
        let fileListOptions = {
            recurseMode: vsls.FileRecurseMode.None,
            excludePatterns: undefined,
            includeDetails: true,
            enableMultipleRoots: this.multiRootWorkspaceEnabled
        };
        let paths = [];
        paths.push(resource.path);
        return this.fileService.listAsync(paths, fileListOptions)
            .then((fileInfo) => {
            // exits is only populated with false if the file does not exist
            return fileInfo[0].exists !== false;
        });
    }
}
exports.DeprecatedWorkspaceProvider = DeprecatedWorkspaceProvider;

//# sourceMappingURL=workspaceProvider.js.map
