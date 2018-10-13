"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const plsql_settings_1 = require("./plsql.settings");
const events = require("events");
// export interface PLSQLConnectionGroup {
//     group: string;
//     active?: boolean;
//     items: PLSQLConnection[];
// }
class ConnectController {
    constructor() {
        this.eventEmitter = new events.EventEmitter();
    }
    configurationChanged() {
        if (this.connections)
            this.getConnections(true);
    }
    getConnections(refresh) {
        if (refresh || !this.connections) {
            this.connections = plsql_settings_1.PLSQLSettings.getConnections();
            this.active = this.connections.find(item => item.active);
            // force only one connection active
            this.connections.forEach(item => {
                item.active = item === this.active;
            });
            const pattern = plsql_settings_1.PLSQLSettings.getConnectionPattern();
            this.patternActiveInfos = pattern.patternActiveInfos;
            this.patternName = pattern.patternName;
            // recalc activeInfos, according to active connection and pattern
            this.updateActiveInfos(this.active);
            this.notifyActive(this.active);
            this.saveConnections();
        }
        return this.connections;
    }
    // public getConnectionsHierarchie(refresh?: boolean): PLSQLConnectionGroup[] {
    //     let group;
    //     const result: PLSQLConnectionGroup[] = [];
    //     this.getConnections(refresh);
    //     if (this.connections) {
    // TODO if !database, group = database ?
    //         this.connections.sort((a,b) => a.database.localeCompare(b.database));
    //         this.connections.forEach(item => {
    //             // TODO if group = database ?
    //             if (!group || (group.group !== item.database)) {
    //                 if (group)
    //                     group.active = group.items.find(connection => connection.active) != null;
    //                 group = {group: item.database, items: []};
    //                 result.push(group);
    //             }
    //             group.items.push(item);
    //         });
    //     }
    //     return result;
    // }
    updateActiveInfos(connection) {
        this.activeInfos = this.getTextInfos(connection);
    }
    getTextInfos(connection) {
        if (this.patternActiveInfos && connection)
            return this.patternActiveInfos
                .replace('${database}', connection.database)
                .replace('${username}', connection.username)
                .replace('${password}', connection.password)
                .replace('${schema}', connection.schema);
        else
            return '';
    }
    getName(connection, index) {
        if (this.patternName && connection)
            return this.patternName
                .replace('${database}', connection.database)
                .replace('${username}', connection.username)
                .replace('${password}', connection.password)
                .replace('${schema}', connection.schema);
        else
            return ('unknown' + (index ? index : this.connections.indexOf(connection)));
    }
    setActive(connection) {
        const element = this.connections.find(item => item.active);
        if (element)
            element.active = false;
        connection.active = true;
        this.updateActiveInfos(connection);
        this.notifyActive(connection);
        this.saveConnections();
    }
    addConnection(connection) {
        if (connection.active) {
            const element = this.connections.find(item => item.active);
            if (element)
                element.active = false;
            this.updateActiveInfos(connection);
            this.notifyActive(connection);
        }
        this.connections.push(connection);
        this.saveConnections();
    }
    saveConnections() {
        if (!(this.connections && this.connections.length))
            return;
        const config = vscode.workspace.getConfiguration('plsql-language');
        // TODO if no workspace !...
        config.update('connections', this.connections, false);
        config.update('connection.activeInfos', this.activeInfos, false);
    }
    notifyActive(connection) {
        this.eventEmitter.emit('setActive', connection);
    }
}
exports.ConnectController = ConnectController;
//# sourceMappingURL=connect.controller.js.map