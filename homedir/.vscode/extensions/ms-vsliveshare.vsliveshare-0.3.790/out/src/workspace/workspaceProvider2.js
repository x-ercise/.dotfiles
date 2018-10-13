//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const buffer = require("buffer");
const traceSource_1 = require("../tracing/traceSource");
const vsls = require("../contracts/VSLS");
const url = require("url");
const session_1 = require("../session");
const sessionTypes_1 = require("../sessionTypes");
const config = require("../config");
const util_1 = require("../util");
const binaryPreamble = [
    0x4D, 0x58, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00,
    0xB8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00,
    0x0E, 0x1F, 0xBA, 0x0E, 0x00, 0xB4, 0x09, 0xCD, 0x21, 0xB8, 0X01, 0x4C, 0xCD, 0x21, 0x54, 0x68
];
function getBinaryPreamble() {
    return buffer.Buffer.from(binaryPreamble);
}
exports.getBinaryPreamble = getBinaryPreamble;
class WorkspaceProvider {
    constructor(workspaceService, fileService) {
        this.workspaceService = workspaceService;
        this.fileService = fileService;
        this._version = 8; // tslint:disable-line
        this.onFilesChangedEmitter = new vscode.EventEmitter();
        this.eventRegistrations = [];
        this.workspaceProviders = [];
        this.isDisposed = false;
        this.multiRootWorkspaceEnabled = config.featureFlags.multiRootWorkspaceVSCode;
        this.uriPrefix = config.get(config.Key.scheme) + ':';
        /**
         * An event to signal that a resource has been created, changed, or deleted. This
         * event should fire for resources that are being [watched](#FileSystemProvider2.watch)
         * by clients of this provider.
         */
        this.onDidChangeFile = this.onFilesChangedEmitter.event;
        this.getFileStat = (fileInfo, id) => {
            let fileStat = {
                mtime: Date.parse(fileInfo.mtime),
                ctime: Date.parse(fileInfo.mtime),
                size: fileInfo.size ? fileInfo.size : 0,
                type: fileInfo.isDirectory ? vscode.FileType.Directory : vscode.FileType.File
            };
            return fileStat;
        };
        this.trace = traceSource_1.traceSource.withName(traceSource_1.TraceSources.ClientFileProvider);
        this.workspaceService.onConnectionStatusChanged(this.onWorkspaceConnectionStatusChanged, this, this.eventRegistrations);
        this.fileService.onFilesChanged(this.onFilesChanged, this, this.eventRegistrations);
    }
    registerWorkspaceProvider(workspaceProvider) {
        this.workspaceProviders.push(workspaceProvider);
    }
    fireFilesChanged(changes) {
        this.onFilesChangedEmitter.fire(changes);
    }
    onWorkspaceConnectionStatusChanged(e) {
        this.currentConnectionStatus = e.connectionStatus;
    }
    onFilesChanged(e) {
        const changes = e.changes.map(change => {
            const changePath = util_1.PathUtil.getRelativePathFromPrefixedPath(change.fullPath);
            const changeUri = vscode.Uri.parse(`${this.uriPrefix}${changePath}`);
            const fileChange = {
                type: WorkspaceProvider.toFileChangeType(change.changeType),
                uri: changeUri
            };
            return fileChange;
        });
        this.onFilesChangedEmitter.fire(changes);
    }
    static toFileChangeType(changeType) {
        switch (changeType) {
            case vsls.FileChangeType.Added:
                return vscode.FileChangeType.Created;
            case vsls.FileChangeType.Deleted:
                return vscode.FileChangeType.Deleted;
            case vsls.FileChangeType.Updated:
                return vscode.FileChangeType.Changed;
            default: throw new Error('changeType not supported');
        }
    }
    dispose() {
        this.isDisposed = true;
        this.eventRegistrations.forEach((r) => r.dispose());
    }
    /**
     * Subscribe to events in the file or folder denoted by `uri`.
     * @param uri
     * @param options
     */
    watch(uri, options) {
        return {
            dispose() {
                /* TODO: @Daniel, implement proper file watching once we have support in the Agent */
                /* Right now we fire onDidChangeFile for every file change */
                /* empty */
            }
        };
    }
    /**
     * Retrieve metadata about a file.
     *
     * @param uri The uri of the file to retrieve meta data about.
     * @return The file metadata about the file.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `uri` doesn't exist.
     */
    async stat(uri) {
        await session_1.SessionContext.waitForJoiningCompleted();
        if (!this.isSessionActive) {
            return this.getDefaultFileStat(uri);
        }
        if (uri.path === '/' || uri.path === '') {
            return {
                type: vscode.FileType.Directory,
                ctime: 0,
                mtime: 0,
                size: 0
            };
        }
        const paths = [uri.path];
        let fileListOptions = {
            recurseMode: vsls.FileRecurseMode.None,
            excludePatterns: undefined,
            includeDetails: true,
            enableMultipleRoots: this.multiRootWorkspaceEnabled
        };
        const fileInfos = await this.fileService.listAsync(paths, fileListOptions);
        // Invoke onStat method on providers
        for (const provider of this.workspaceProviders.filter(p => p.onStat)) {
            await provider.onStat(fileInfos);
        }
        if (fileInfos.length === 0 || fileInfos[0].exists === false) {
            throw WorkspaceProvider.fileError("FileNotFound" /* FileNotFound */, uri);
        }
        return this.getFileStat(fileInfos[0], uri.toString());
    }
    /**
     * Read the entire contents of a file.
     *
     * @param uri The uri of the file.
     * @return An array of bytes or a thenable that resolves to such.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `uri` doesn't exist.
     */
    async readFile(uri) {
        await session_1.SessionContext.waitForJoiningCompleted();
        if (!uri.path.length || !this.isSessionActive) {
            throw WorkspaceProvider.fileError("FileNotFound" /* FileNotFound */, uri);
        }
        let fileTextInfo;
        try {
            fileTextInfo = await this.fileService.readTextAsync(uri.path, {});
        }
        catch (e) {
            // throw a friendlier error
            throw new Error('Please wait to open workspace files until the collaboration session is joined.');
        }
        // Invoke onReadFile method on providers
        for (const provider of this.workspaceProviders.filter(p => p.onReadFile)) {
            await provider.onReadFile(fileTextInfo);
        }
        if (fileTextInfo.exists === false) {
            throw WorkspaceProvider.fileError("FileNotFound" /* FileNotFound */, uri);
        }
        // The file we received from the file service is not guaranteed to be completely synchronized with coauthoring.
        // Wait for the coauthoring client to fully synchronize it.
        let result = fileTextInfo.text;
        const coAuthoringFileName = session_1.SessionContext.coeditingClient.uriToFileName(uri);
        if (coAuthoringFileName && !(fileTextInfo.attributes === vsls.FileAttributes.Hidden)) {
            result = await session_1.SessionContext.coeditingClient.performFileOpenHandshake(coAuthoringFileName, result);
            if (typeof result === 'boolean' && result === false) {
                // Since we couldn't open the file, it likely (Although not
                // guarnetees) that the file is binary. Lets return some binary
                // pre-amble to the requester, so that (hopefully) they fall into
                // the 'binary file error handling' path. 
                return Promise.resolve(getBinaryPreamble());
            }
        }
        let fileBuffer = buffer.Buffer.from(result, 'utf8');
        return Promise.resolve(fileBuffer);
    }
    /**
     * Write data to a file, replacing its entire contents.
     *
     * @param uri The uri of the file.
     * @param content The new content of the file.
     * @param options Defines is missing files should or must be created.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `uri` doesn't exist and `create` is not set.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when the parent of `uri` doesn't exist and `create` is set.
     * @throws [`FileExists`](#FileSystemError.FileExists) when `uri` already exists and `overwrite` is set.
     * @throws [`NoPermissions`](#FileSystemError.NoPermissions) when permissions aren't sufficient.
     */
    async writeFile(uri, content, options) {
        await session_1.SessionContext.waitForJoiningCompleted();
        if (!this.isSessionActive) {
            // When a session is terminated remotely, part of our clean up tries
            // to save the file. We need to report it as successful otherwise
            // an error is propogated to the save request in the UI, and we don't
            // completely clean up the session when we're a guest.
            // Thus, return a total lie: Yep, we saved it! *wink*.
            return;
        }
        try {
            // First check if the file exists
            const exists = await this.fileExists(uri);
            if (exists && !(options && options.overwrite)) {
                throw WorkspaceProvider.fileError("FileExists" /* FileExists */, uri);
            }
            else if (!exists && !(options && options.create)) {
                throw WorkspaceProvider.fileError("FileNotFound" /* FileNotFound */, uri);
            }
            else if (exists) {
                // The co-editing client takes care of sending a save request to the owner, so there is nothing to do here.
                return;
            }
            // The participant is creating a new file
            const stringContent = content.toString();
            const fileInfo = await this.fileService.writeTextAsync(uri.path, stringContent, { append: false, createIfNotExist: true });
            if (fileInfo.exists === false) {
                // The file service did not allow creating the file, possibly because it's in an excluded path.
                throw WorkspaceProvider.fileError("NoPermissions" /* NoPermissions */, uri);
            }
        }
        catch (e) {
            // To prevent dirty files and the "Save before closing?" dialog, report a save success.
            this.trace.error(e.message);
            return;
        }
    }
    /**
     * Rename a file or folder.
     *
     * @param oldUri The existing file or folder.
     * @param newUri The target location.
     * @param options Defines if existing files should be overwriten.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `oldUri` doesn't exist.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when parent of `newUri` doesn't exist
     * @throws [`FileExists`](#FileSystemError.FileExists) when `newUri` exists and when the `overwrite` option is not `true`.
     * @throws [`NoPermissions`](#FileSystemError.NoPermissions) when permissions aren't sufficient.
     */
    async rename(oldUri, newUri, options) {
        await session_1.SessionContext.waitForJoiningCompleted();
        if (!this.isSessionActive) {
            throw WorkspaceProvider.fileError("FileNotFound" /* FileNotFound */, oldUri);
        }
        const oldExists = await this.fileExists(oldUri);
        if (!oldExists) {
            throw WorkspaceProvider.fileError("FileNotFound" /* FileNotFound */, oldUri);
        }
        if (!(options && options.overwrite)) {
            const newExists = await this.fileExists(newUri);
            if (newExists) {
                throw WorkspaceProvider.fileError("FileExists" /* FileExists */, newUri);
            }
        }
        const fileInfo = await this.fileService.moveAsync(oldUri.path, url.parse(newUri.path).path, { overwrite: false });
        if (fileInfo.exists === false) {
            throw WorkspaceProvider.fileError("NoPermissions" /* NoPermissions */, newUri);
        }
    }
    /**
     * Create a new directory. *Note* that new files are created via `write`-calls.
     *
     * @param uri The uri of the new folder.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when the parent of `uri` doesn't exist.
     * @throws [`FileExists`](#FileSystemError.FileExists) when `uri` already exists.
     * @throws [`NoPermissions`](#FileSystemError.NoPermissions) when permissions aren't sufficient.
     */
    async createDirectory(uri) {
        await session_1.SessionContext.waitForJoiningCompleted();
        if (!this.isSessionActive) {
            throw WorkspaceProvider.fileError("FileNotFound" /* FileNotFound */, uri);
        }
        const dirInfo = await this.fileService.createDirectoryAsync(uri.path);
        if (dirInfo.exists === false) {
            throw WorkspaceProvider.fileError("NoPermissions" /* NoPermissions */, uri);
        }
    }
    /**
     * Retrieve the meta data of all entries of a [directory](#FileType.Directory)
     *
     * @param uri The uri of the folder.
     * @return An array of name/type-tuples or a thenable that resolves to such.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `uri` doesn't exist.
     */
    async readDirectory(uri) {
        await session_1.SessionContext.waitForJoiningCompleted();
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
        let fileInfos;
        fileInfos = await this.fileService.listAsync([uri.path], fileListOptions);
        // Invoke onReadDirectory method on providers
        for (const provider of this.workspaceProviders.filter(p => p.onReadDirectory)) {
            await provider.onReadDirectory(fileInfos);
        }
        if (fileInfos.length !== 1 || fileInfos[0].exists === false) {
            throw WorkspaceProvider.fileError("FileNotFound" /* FileNotFound */, uri);
        }
        fileInfos = fileInfos[0].children;
        if (fileInfos) {
            fileInfos.forEach(fi => {
                let fileUri = uri.with({ path: fi.path });
                let fileStat = this.getFileStat(fi, fileUri.toString());
                let fileName = path.basename(fi.path);
                result.push([fileName, fileStat.type]);
            });
        }
        return result;
    }
    /**
     * Delete a file.
     *
     * @param uri The resource that is to be deleted.
     * @param options Defines if deletion of folders is recursive.
     * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `uri` doesn't exist.
     * @throws [`NoPermissions`](#FileSystemError.NoPermissions) when permissions aren't sufficient.
     */
    async delete(uri) {
        await session_1.SessionContext.waitForJoiningCompleted();
        if (!this.isSessionActive) {
            throw WorkspaceProvider.fileError("FileNotFound" /* FileNotFound */, uri);
        }
        return this.fileService.deleteAsync(uri.path, { useTrash: true });
    }
    get isSessionActive() {
        const isJoined = (session_1.SessionContext.State === sessionTypes_1.SessionState.Joined);
        const isConnected = (this.currentConnectionStatus !== vsls.WorkspaceConnectionStatus.Disconnected);
        const isSessionActive = isJoined && isConnected && !this.isDisposed;
        return isSessionActive;
    }
    getDefaultFileStat(resource) {
        return Promise.resolve({
            type: vscode.FileType.Directory,
            mtime: 0,
            ctime: 0,
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
    /**
     * Creates a vscode.FileSystemError object from the specified error name,
     * and file or directory URI.
     */
    static fileError(error, uri) {
        let message = util_1.ExtensionUtil.getString('fileError.' + error) ||
            `Error (${error}): ${uri.path}`;
        if (uri) {
            message = message.replace('$(path)', uri.path);
        }
        const errorFunction = vscode.FileSystemError[error];
        return errorFunction ? errorFunction(message) : new Error(message);
    }
}
exports.WorkspaceProvider = WorkspaceProvider;

//# sourceMappingURL=workspaceProvider2.js.map
