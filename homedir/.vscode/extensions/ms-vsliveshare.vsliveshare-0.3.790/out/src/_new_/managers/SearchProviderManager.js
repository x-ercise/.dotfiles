"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const semver = require("semver");
const config = require("../../config");
const util = require("../../util");
const searchProvider_1 = require("../../workspace/searchProvider");
class SearchProviderManager {
    constructor(dependencies) {
        this.fileService = dependencies.fileService();
    }
    async init() {
        if (config.featureFlags.findFiles &&
            semver.gte(semver.coerce(vscode.version), '1.26.0') &&
            vscode.workspace.registerTextSearchProvider &&
            vscode.workspace.registerFileIndexProvider) {
            const provider = new searchProvider_1.SearchProvider(this.fileService);
            util.ExtensionUtil.Context.subscriptions.push(vscode.workspace.registerTextSearchProvider(config.get(config.Key.authority), provider));
            util.ExtensionUtil.Context.subscriptions.push(vscode.workspace.registerFileIndexProvider(config.get(config.Key.authority), provider));
        }
    }
    async dispose() { }
}
exports.SearchProviderManager = SearchProviderManager;

//# sourceMappingURL=SearchProviderManager.js.map
