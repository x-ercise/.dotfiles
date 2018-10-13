"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
class ConnectTreeProvider {
    constructor(controllerUI, controller) {
        this.controllerUI = controllerUI;
        this.controller = controller;
        /* tslint:disable */
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        /* tslint:enable*/
        this.iconPath = {
            database: {
                light: path.join(__filename, '..', '..', '..', 'resources', 'images', 'light', 'database.png'),
                dark: path.join(__filename, '..', '..', '..', 'resources', 'images', 'dark', 'database.png')
            },
            databaseActive: path.join(__filename, '..', '..', '..', 'resources', 'images', 'common', 'database_active.png'),
            connection: {
                light: path.join(__filename, '..', '..', '..', 'resources', 'images', 'light', 'connection.png'),
                dark: path.join(__filename, '..', '..', '..', 'resources', 'images', 'dark', 'connection.png')
            },
            connectionActive: path.join(__filename, '..', '..', '..', 'resources', 'images', 'common', 'connection_active.png')
        };
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        return new Promise(resolve => {
            if (!element) { // root
                if (!this.tree) {
                    this.tree = {};
                    if (!this.connections)
                        this.connections = this.controller.getConnectionsHierarchie(true);
                    this.connections.forEach(item => {
                        this.tree[item.group] = { group: new ConnectTreeItem(this, item.group, 0 /* Group */, item) };
                    });
                }
                resolve(Object.keys(this.tree).map(item => this.tree[item].group));
            }
            else {
                const group = this.tree[element.label];
                if (!group.items) {
                    const connectionGroup = this.connections.find(item => item.group === element.label);
                    group.items = connectionGroup.items.map(connection => new ConnectTreeItem(this, this.controller.format(connection), 1 /* Connection */, group, connection));
                }
                resolve(group.items);
            }
        });
    }
    redraw() {
        delete this.tree;
        this._onDidChangeTreeData.fire();
    }
    refresh() {
        delete this.tree;
        delete this.connections;
        this._onDidChangeTreeData.fire();
    }
    settings() {
        vscode.commands.executeCommand('workbench.action.openWorkspaceSettings');
    }
    new() {
        this.controllerUI.addConnection();
        this.refresh();
    }
    activateEntry(element) {
        this.controller.setActive(element.connection);
        this.connections.forEach(item => {
            item.active = item.items.find(connection => connection.active) != null;
        });
        this.redraw();
    }
}
exports.default = ConnectTreeProvider;
class ConnectTreeItem extends vscode.TreeItem {
    constructor(provider, label = '', kind, group, connection) {
        super(label, kind === 0 /* Group */ ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        this.kind = kind;
        this.connection = connection;
        this.group = group;
        this.provider = provider;
        this.setIconPath();
        switch (this.kind) {
            case 1 /* Connection */:
                this.contextValue = 'plsqlLanguageConnection';
                this.command = {
                    command: 'treePLSQLLanguage.activateEntry',
                    title: 'Activate',
                    arguments: [this]
                };
                break;
            case 0 /* Group */:
                this.contextValue = 'plsqlLanguageGroup';
                break;
            default:
                this.contextValue = 'plsqlLanguageNone';
        }
    }
    setIconPath() {
        switch (this.kind) {
            case 1 /* Connection */:
                this.iconPath = this.connection.active ? this.provider.iconPath.connectionActive : this.provider.iconPath.connection;
                break;
            case 0 /* Group */:
                this.iconPath = this.group.active ? this.provider.iconPath.databaseActive : this.provider.iconPath.database;
                break;
        }
    }
}
//# sourceMappingURL=connectTree.provider.js.map