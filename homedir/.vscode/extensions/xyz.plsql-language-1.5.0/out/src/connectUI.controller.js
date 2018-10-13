"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const connect_inputPannel_1 = require("./connect.inputPannel");
class ConnectUIController {
    constructor(context, controller) {
        this.context = context;
        this.controller = controller;
    }
    activateConnectionsList() {
        const me = this;
        let connections = this.controller.getConnections(true);
        const active = this.controller.active;
        if (active) {
            connections = connections.filter(item => item !== active);
            connections.unshift(this.controller.active);
        }
        const displayItems = connections.map((item, index) => {
            return {
                label: `${item.active ? '$(check) ' : ''} ${this.controller.getName(item, index)}`,
                item: item,
                action: 'setActive'
            };
        });
        displayItems.push({
            label: '<Insert a new connection>',
            item: undefined,
            action: 'addConnection'
        });
        displayItems.push({
            label: '<Settings>',
            item: undefined,
            action: 'showSettings'
        });
        vscode.window.showQuickPick(displayItems)
            .then(val => {
            if (val) {
                me[val.action].apply(me, [val.item]);
            }
        });
    }
    // used via displayItem.action
    /*private*/ setActive(connection) {
        this.controller.setActive(connection);
    }
    /*private*/ addConnection() {
        connect_inputPannel_1.default.createOrShow(this.context.extensionPath, this.controller);
    }
    /*private*/ showSettings() {
        vscode.commands.executeCommand('workbench.action.openSettings');
    }
}
exports.default = ConnectUIController;
//# sourceMappingURL=connectUI.controller.js.map