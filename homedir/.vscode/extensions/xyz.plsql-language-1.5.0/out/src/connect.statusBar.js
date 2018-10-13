"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
class ConnectStatusBar {
    constructor(controller) {
        this.controller = controller;
        const me = this;
        me.statusBar = vscode.window.createStatusBarItem();
        controller.eventEmitter.on('setActive', (connection) => me.activeChange(connection));
        controller.getConnections();
        me.statusBar.command = 'plsql.activateConnection';
    }
    activeChange(connection) {
        if (connection) {
            this.statusBar.text = `$(database) ${this.controller.getName(connection)}`;
            // this.statusBar.tooltip =;
        }
        else {
            this.statusBar.text = `$(database) <none>`;
            // this.statusBar.tooltip =;
        }
        if (!this.statusBarVisible && connection) {
            this.statusBar.show();
            this.statusBarVisible = true;
        }
    }
}
exports.ConnectStatusBar = ConnectStatusBar;
//# sourceMappingURL=connect.statusBar.js.map