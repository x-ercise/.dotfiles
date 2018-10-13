"use strict";
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const uuid = require("uuid");
const vscode = require("vscode");
const config = require("../config");
const util_1 = require("../util");
/** Provides converters from vscode Uri to LSP protocol paths and back.
 *  Also manages paths for documents external to the shared workspace.
 */
class PathManager {
    constructor(enableMultipleRoots, forcePrefixedRoot) {
        this.enableMultipleRoots = enableMultipleRoots;
        this.forcePrefixedRoot = forcePrefixedRoot;
        this.externalUriToIds = new Map();
        this.externalIdToUris = new Map();
        this.scheme = `${config.get(config.Key.scheme)}:`;
        this.rawScheme = config.get(config.Key.scheme);
    }
    /**
     * Given a generated external uri string get the original Uri
     */
    getOriginalUri(externalUri) {
        // The value we get may not be fully %-encoded. Since the values we have as keys are %-encoded
        // create a uri and get it's %-encoded value.
        let encodedValue = vscode.Uri.parse(externalUri).toString().toLowerCase();
        if (!this.externalIdToUris.has(encodedValue)) {
            throw new Error('Unknown document id');
        }
        return this.externalIdToUris.get(encodedValue);
    }
    /**
     * Convert from the host paths to a vsls URI which looks like (vsls:/<relative path from workspace root>) with forward slashes.
     */
    code2ProtocolUriConverter(value) {
        if (!value) {
            return undefined;
        }
        // If we have a http\https uri or a command (e.g. a markdown link), pass them through because operations on those should happen on the client side.
        if (value.scheme.toLowerCase() === 'http' || value.scheme.toLowerCase() === 'https' || value.scheme.toLowerCase() === 'command') {
            return value.toString();
        }
        const protocolWorkspacePath = this.code2protocolWorkspaceFilesOnly(value);
        if (protocolWorkspacePath !== null) {
            return protocolWorkspacePath.toString();
        }
        // This is an external URL, so we need to create & cache the URLs for
        // those URLs, and ensure they're correctly encoded.
        let uriString = value.toString();
        if (this.externalUriToIds.has(uriString)) {
            return this.externalUriToIds.get(uriString);
        }
        let fileName = path.basename(value.fsPath);
        let guid = uuid().replace(/-/g, '');
        // Create a URI and call toString so that it gets %-encoded. Other parts of the system will %-encode the string.
        let externalUri = vscode.Uri.parse(`${PathManager.vslsExternalScheme}:/${guid}/${fileName}`).toString().toLowerCase();
        this.externalUriToIds.set(uriString, externalUri);
        this.externalIdToUris.set(externalUri, value);
        return externalUri;
    }
    code2protocolWorkspaceFilesOnly(uri) {
        if (uri.scheme !== 'file') {
            // Only supports file schemed URIs
            return null;
        }
        // If the given uri is outside of the workspace, workspaceFolder will be undefined.
        let workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) {
            return null;
        }
        // File is anchored under the workspace, so it's fine to just convert
        // this our vsls format for sharing on the wire
        const relativePath = vscode.workspace.asRelativePath(uri, false);
        const vslsPathAsString = util_1.PathUtil.convertToForwardSlashes(relativePath);
        let rootPrefix = '';
        if (this.enableMultipleRoots && (workspaceFolder.index > 0 || this.forcePrefixedRoot)) {
            rootPrefix = `~${workspaceFolder.index}/`;
        }
        return vscode.Uri.parse(`${this.scheme}/${rootPrefix}${vslsPathAsString}`);
    }
    /**
     * Convert from a protocol path which is a vsls uri to local paths.
     */
    protocol2CodeUriConverter(value) {
        if (!value) {
            return undefined;
        }
        return this.protocolUri2CodeUriConverter(vscode.Uri.parse(value));
    }
    protocolUri2CodeUriConverter(value) {
        const primaryPath = vscode.workspace.workspaceFolders[0];
        const scheme = value.scheme.toLowerCase();
        // If we're handed a path that is for our scheme, and the root is also
        // our scheme then pass it through, since it's already in the correct
        // structure.
        if ((scheme === this.rawScheme && primaryPath.uri.scheme === this.rawScheme)
            || scheme === 'http'
            || scheme === 'https') {
            return value;
        }
        if (scheme === PathManager.vslsExternalScheme) {
            return this.getOriginalUri(value.toString());
        }
        if (scheme !== this.rawScheme) {
            throw new Error('Unknown path format from the client');
        }
        // Get the actual folder this is for.
        let { moniker, relativePath } = util_1.PathUtil.getMonikerFromUri(value);
        let rootIndex = parseInt(moniker, 10);
        let pathPrefix = primaryPath.uri.fsPath;
        if (moniker !== '') {
            const workspaceFolder = vscode.workspace.workspaceFolders[rootIndex];
            if (!workspaceFolder) {
                return value;
            }
            pathPrefix = workspaceFolder.uri.fsPath;
        }
        if (pathPrefix.endsWith('/') || pathPrefix.endsWith('\\')) {
            pathPrefix = pathPrefix.substr(0, pathPrefix.length - 1);
        }
        if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
            relativePath = relativePath.substring(1);
        }
        return vscode.Uri.file(path.join(pathPrefix, relativePath));
    }
    relativePathToLocalPath(relativePath) {
        if (!relativePath) {
            return null;
        }
        if (relativePath.startsWith(this.scheme) || relativePath.startsWith('file:')) {
            throw new Error('Supplied path is not a relative path');
        }
        let protocolPrefixedPath = null;
        if (relativePath.startsWith('/')) {
            protocolPrefixedPath = `${this.scheme}${relativePath}`;
        }
        else {
            protocolPrefixedPath = `${this.scheme}/${relativePath}`;
        }
        return this.protocol2CodeUriConverter(protocolPrefixedPath);
    }
    localPathToRelativePath(localPath) {
        if (!localPath) {
            return null;
        }
        if (localPath.scheme === this.rawScheme) {
            return localPath.path;
        }
        const originalPath = localPath.fsPath;
        const strippedPath = vscode.workspace.asRelativePath(localPath, false);
        if (originalPath === strippedPath) {
            // The original path was unchanged, this means that it wasn't actually
            // a file relative to a workspace, so not of interest to us.
            return null;
        }
        const asProtocol = this.code2protocolWorkspaceFilesOnly(localPath);
        return asProtocol.path;
    }
    dispose() {
        this.externalIdToUris.clear();
        this.externalUriToIds.clear();
    }
    static getPathManager() {
        const enableMultipleRoots = config.featureFlags.multiRootWorkspaceVSCode;
        return new PathManager(enableMultipleRoots);
    }
}
PathManager.vslsExternalScheme = 'vslsexternal';
exports.PathManager = PathManager;

//# sourceMappingURL=pathManager.js.map
