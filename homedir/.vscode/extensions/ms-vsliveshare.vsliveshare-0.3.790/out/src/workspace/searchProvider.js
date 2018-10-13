//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const semver = require("semver");
const vscode = require("vscode");
const vsls = require("../contracts/VSLS");
const config = require("../config");
const traceSource_1 = require("../tracing/traceSource");
const telemetry_1 = require("../telemetry/telemetry");
const searchServiceTelemetry_1 = require("../telemetry/searchServiceTelemetry");
const pathManager_1 = require("../languageService/pathManager");
const util_1 = require("../util");
class SearchProvider {
    constructor(fileservice) {
        this.pathManager = pathManager_1.PathManager.getPathManager();
        this.multiRootWorkspaceEnabled = config.featureFlags.multiRootWorkspaceVSCode;
        this.fileservice = fileservice;
        this.fileSearchOptionsMap = new Map();
        this.fileListMap = new Map();
        this.fileservice.onFilesChanged((e) => this.onFilesChanged(e));
        this.trace = traceSource_1.traceSource.withName(traceSource_1.TraceSources.AgentFile);
    }
    async onFilesChanged(e) {
        for (let change of e.changes) {
            await this.updateList(change);
        }
    }
    async updateList(change) {
        const { moniker } = util_1.PathUtil.getMonikerFromRelativePath(change.fullPath);
        const changePath = util_1.PathUtil.getRelativePathFromPrefixedPath(change.fullPath);
        const root = util_1.PathUtil.getPrefixedRoot(moniker);
        let filePaths = this.fileListMap.get(root);
        if (!filePaths) {
            filePaths = [];
        }
        switch (change.changeType) {
            case vsls.FileChangeType.Deleted:
                let index = filePaths ? filePaths.indexOf(changePath) : -1;
                if (index === -1) {
                    break;
                }
                filePaths.splice(index, 1);
                break;
            case vsls.FileChangeType.Added:
                // if we haven't done a search for this root, we
                // won't have options or anything to update.
                const options = this.fileSearchOptionsMap.get(root);
                if (!options) {
                    break;
                }
                //check if file is excluded
                let fileOptions = {
                    excludePatterns: options.excludes,
                    enableMultipleRoots: this.multiRootWorkspaceEnabled
                };
                if (!(await this.fileservice.isExcludedAsync(changePath, fileOptions))) {
                    filePaths.push(changePath);
                }
                break;
            default:
                break;
        }
        this.fileListMap.set(root, filePaths);
    }
    async getFiles(options, token) {
        try {
            let includeList = [options.folder.path];
            let fileOptions = {
                excludePatterns: options.excludes,
                enableMultipleRoots: config.featureFlags.multiRootWorkspaceVSCode,
                includePatterns: includeList.concat(options.includes)
            };
            let filePaths = await this.fileservice.getFilesAsync(fileOptions, token);
            this.fileListMap.set(options.folder.path, filePaths);
            searchServiceTelemetry_1.FileSearchTelemetry.sendFindFileDiagnostics(filePaths.length, options.useIgnoreFiles);
        }
        catch (e) {
            this.trace.error(e);
            telemetry_1.Instance.sendFault(searchServiceTelemetry_1.SearchServiceTelemetryEventNames.FIND_FILE_FAULT, telemetry_1.FaultType.Error, 'Failed to get files from host', e);
        }
    }
    async provideFileIndex(options, token) {
        let root = options.folder.path;
        let fileList = this.fileListMap.get(root);
        if (!fileList || !this.fileSearchOptionsMap.has(root)) {
            await this.getFiles(options, token);
            this.fileSearchOptionsMap.set(root, options);
        }
        fileList = this.fileListMap.get(root);
        if (fileList) {
            const vslsUris = fileList.map(relativePath => {
                return this.pathManager.relativePathToLocalPath(relativePath);
            });
            return vslsUris;
        }
        return null;
    }
    toVsCodeTextSearchResult(result) {
        let vslsUri = this.pathManager.relativePathToLocalPath(result.path);
        return {
            uri: vslsUri,
            range: new vscode.Range(result.line, result.column, result.line, result.column + result.length),
            preview: {
                text: result.text,
                match: new vscode.Range(result.line, result.column, result.line, result.column + result.length)
            }
        };
    }
    toOldVsCodeTextSearchResult(result) {
        let vslsUri = this.pathManager.relativePathToLocalPath(result.path);
        return {
            path: vslsUri.path,
            range: new vscode.Range(result.line, result.column, result.line, result.column + result.length),
            preview: {
                text: result.text,
                match: new vscode.Range(result.line, result.column, result.line, result.column + result.length)
            }
        };
    }
    toVslsTextSearchOptions(query, options) {
        return {
            pattern: query.pattern,
            isRegex: query.isRegExp,
            isCaseSensitive: query.isCaseSensitive,
            isWordMatch: query.isWordMatch,
            includeHiddenFiles: options.useIgnoreFiles,
            encoding: options.encoding,
            fileIncludes: options.includes,
            fileExcludes: options.excludes
        };
    }
    provideTextSearchResults(query, options, progress, token) {
        return new Promise(async (resolve, reject) => {
            if (!config.featureFlags.textSearch) {
                return resolve();
            }
            let vslsOptions = this.toVslsTextSearchOptions(query, options);
            const searchServiceTelemetry = new searchServiceTelemetry_1.TextSearchTelemetry();
            searchServiceTelemetry.startTextSearch();
            let results = [];
            try {
                results = await this.fileservice.getTextSearchResultsAsync(vslsOptions, token);
                searchServiceTelemetry.saveTextSearchResults(results.length);
            }
            catch (e) {
                // Do nothing; host doesn't have latest extension
                return resolve();
            }
            if (semver.gte(semver.coerce(vscode.version), '1.26.0')) {
                results.forEach(result => {
                    let vscodeResult = this.toVsCodeTextSearchResult(result);
                    try {
                        progress.report(vscodeResult);
                    }
                    catch (e) {
                        let oldVscodeResult = this.toOldVsCodeTextSearchResult(result);
                        progress.report(oldVscodeResult);
                    }
                });
            }
            else {
                results.forEach(result => {
                    let oldVscodeResult = this.toOldVsCodeTextSearchResult(result);
                    progress.report(oldVscodeResult);
                });
            }
            if (results.length > 0 && results[results.length - 1].hitResultsLimit === true) {
                vscode.window.showInformationMessage(util_1.ExtensionUtil.getString('info.SearchResultsLimited'));
            }
            searchServiceTelemetry.sendTextSearchDiagnostics();
            resolve();
        });
    }
}
exports.SearchProvider = SearchProvider;
class TextSearchQuery {
}
exports.TextSearchQuery = TextSearchQuery;
class TextSearchOptions {
}
exports.TextSearchOptions = TextSearchOptions;

//# sourceMappingURL=searchProvider.js.map
