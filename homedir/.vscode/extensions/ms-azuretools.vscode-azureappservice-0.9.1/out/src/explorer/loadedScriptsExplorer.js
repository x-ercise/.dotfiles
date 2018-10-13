"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const vscode_1 = require("vscode");
const remoteScriptDocumentProvider_1 = require("../logPoints/remoteScriptDocumentProvider");
const AZURE_JS_DEBUG_TYPE = 'jsLogpoints';
class LoadedScriptsProvider {
    constructor(context) {
        this._onDidChangeTreeData = new vscode_1.EventEmitter();
        // tslint:disable-next-line:member-ordering
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this._root = new RootTreeItem();
        context.subscriptions.push(vscode.debug.onDidStartDebugSession(session => {
            const t = session ? session.type : undefined;
            if (t === AZURE_JS_DEBUG_TYPE) {
                this._root.add(session);
                this._onDidChangeTreeData.fire(undefined);
            }
        }));
        let timeout;
        context.subscriptions.push(vscode.debug.onDidReceiveDebugSessionCustomEvent(event => {
            const t = (event.event === 'loadedSource' && event.session) ? event.session.type : undefined;
            if (t === AZURE_JS_DEBUG_TYPE) {
                const sessionRoot = this._root.add(event.session);
                sessionRoot.addPath(event.body);
                clearTimeout(timeout);
                timeout = setTimeout(() => { this._onDidChangeTreeData.fire(undefined); }, 300);
            }
        }));
        context.subscriptions.push(vscode.debug.onDidTerminateDebugSession(session => {
            this._root.remove(session.id);
            this._onDidChangeTreeData.fire(undefined);
        }));
    }
    getChildren(node) {
        return (node || this._root).getChildren();
    }
    getTreeItem(node) {
        return node;
    }
}
exports.LoadedScriptsProvider = LoadedScriptsProvider;
class BaseTreeItem extends vscode_1.TreeItem {
    constructor(label, state = vscode.TreeItemCollapsibleState.Collapsed) {
        super(label, state);
        this._children = {};
    }
    setSource(session, source) {
        this.command = {
            command: 'appService.LogPoints.OpenScript',
            arguments: [session, source],
            title: ''
        };
    }
    getChildren() {
        this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        const array = Object.keys(this._children).map(key => this._children[key]);
        return array.sort((a, b) => this.compare(a, b));
    }
    createIfNeeded(key, factory) {
        let child = this._children[key];
        if (!child) {
            child = factory(key);
            this._children[key] = child;
        }
        return child;
    }
    remove(key) {
        delete this._children[key];
    }
    compare(a, b) {
        return a.label.localeCompare(b.label); // non-null behavior unknown. Should be handled by logPoints team
    }
}
class RootTreeItem extends BaseTreeItem {
    constructor() {
        super('Root', vscode.TreeItemCollapsibleState.Expanded);
        this._showedMoreThanOne = false;
    }
    getChildren() {
        // skip sessions if there is only one
        const children = super.getChildren();
        if (Array.isArray(children)) {
            const size = children.length;
            if (!this._showedMoreThanOne && size === 1) {
                return children[0].getChildren();
            }
            this._showedMoreThanOne = size > 1;
        }
        return children;
    }
    add(session) {
        return this.createIfNeeded(session.id, () => new SessionTreeItem(session));
    }
}
// tslint:disable:max-classes-per-file
class SessionTreeItem extends BaseTreeItem {
    constructor(session) {
        super(session.name, vscode.TreeItemCollapsibleState.Expanded);
        this._initialized = false;
        this._session = session;
    }
    getChildren() {
        if (!this._initialized) {
            this._initialized = true;
            //return listLoadedScripts(this._session).then(paths => {
            return Promise.resolve([]).then(paths => {
                if (paths) {
                    paths.forEach(path => this.addPath(path));
                }
                return super.getChildren();
            });
        }
        return super.getChildren();
    }
    addPath(source) {
        const path = source.path;
        // tslint:disable-next-line:no-var-self
        let x = this;
        path.split(/[\/\\]/).forEach((segment) => {
            if (segment.length === 0) { // macOS or unix path
                segment = '/';
            }
            x = x.createIfNeeded(segment, () => new BaseTreeItem(segment));
        });
        x.collapsibleState = vscode.TreeItemCollapsibleState.None;
        x.setSource(this._session, source);
    }
    compare(a, b) {
        const acat = this.category(a);
        const bcat = this.category(b);
        if (acat !== bcat) {
            return acat - bcat;
        }
        return super.compare(a, b);
    }
    /**
     * Return an ordinal number for folders
     */
    category(item) {
        // <...> come at the very end
        if (/^<.+>$/.test(item.label)) { // non-null behavior unknown. Should be handled by logPoints team
            return 1000;
        }
        // everything else in between
        return 999;
    }
}
function openScript(session, source) {
    if (!session) {
        vscode.window.showErrorMessage("Cannot find the debug session");
        return;
    }
    const uri = remoteScriptDocumentProvider_1.RemoteScriptSchema.create(session, source);
    vscode.workspace.openTextDocument(uri).then(doc => vscode.window.showTextDocument(doc));
}
exports.openScript = openScript;
//# sourceMappingURL=loadedScriptsExplorer.js.map