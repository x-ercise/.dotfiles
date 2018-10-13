"use strict";
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const vsls = require("./contracts/VSLS");
const pathManager_1 = require("./languageService/pathManager");
const config = require("./config");
class TextSearchService {
    constructor(workspaceService) {
        this.workspaceService = workspaceService;
        this.rpcClient = workspaceService.client;
    }
    async initAsync() {
        this.rpcClient.addRequestMethod(vsls.TextSearchService.name + '.getTextSearchResults', async (options, token) => {
            return this.getTextSearchResultsAsync(options, token);
        });
    }
    toVscodeQuery(options) {
        return {
            pattern: options.pattern,
            isRegExp: options.isRegex,
            isCaseSensitive: options.isCaseSensitive,
            isWordMatch: options.isWordMatch
        };
    }
    toVscodeOptions(options) {
        return {
            folder: null,
            includes: options.fileIncludes,
            excludes: options.fileExcludes,
            encoding: options.encoding,
            useIgnoreFiles: options.includeHiddenFiles
        };
    }
    toVslsResult(result) {
        let pathManager = pathManager_1.PathManager.getPathManager();
        let relativeUri = pathManager.localPathToRelativePath(result.uri);
        return {
            path: relativeUri,
            text: result.preview.text,
            line: result.range.start.line,
            column: result.range.start.character,
            length: (result.range.end.character - result.range.start.character)
        };
    }
    async getTextSearchResultsAsync(options, cancellationToken) {
        let results = [];
        let vscodeQuery = this.toVscodeQuery(options);
        let vscodeOptions = this.toVscodeOptions(options);
        let counter = 0;
        let searchCancellationSource = new vscode.CancellationTokenSource();
        let textSearchResultsLimit = config.get(config.Key.textSearchResultsLimit);
        let textSearchPreviewLimit = config.get(config.Key.textSearchPreviewLimit);
        let hitResultsLimit = false;
        //if (cancellationToken) {
        //cancellationToken.onCancellationRequested(() => {
        //searchCancellationSource.cancel();
        //});
        //}
        if (vscode.workspace.findTextInFiles) {
            try {
                await vscode.workspace.findTextInFiles(vscodeQuery, vscodeOptions, (result) => {
                    if (counter < textSearchResultsLimit &&
                        result.preview.text.length <= textSearchPreviewLimit) {
                        results.push(result);
                        counter++;
                    }
                    else if (counter === textSearchResultsLimit) {
                        hitResultsLimit = true;
                        //searchCancellationSource.cancel();
                    }
                }, searchCancellationSource.token);
            }
            catch (e) {
            }
        }
        let vslsResults = results.map(this.toVslsResult).filter(o => o.path);
        if (hitResultsLimit && vslsResults.length > 0) {
            vslsResults[vslsResults.length - 1].hitResultsLimit = true;
        }
        return vslsResults;
    }
    async dispose() {
    }
}
exports.TextSearchService = TextSearchService;

//# sourceMappingURL=textSearchService.js.map
