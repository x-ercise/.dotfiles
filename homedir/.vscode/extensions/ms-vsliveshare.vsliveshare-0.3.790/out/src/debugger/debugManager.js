"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
const vscode = require("vscode");
const events = require("events");
/*
 * Class to be used for the extension before a share or join take place
*/
class DebugManager extends events.EventEmitter {
    constructor() {
        super();
        this.activeDebugSessions = [];
        // advise to start/terminate vsCode debug sessions
        this.onDidStartDebugSessionEvt = vscode.debug.onDidStartDebugSession(this.onDidStartDebugSession, this);
        this.onDidTerminateDebugSessionEvt = vscode.debug.onDidTerminateDebugSession(this.onDidTerminateDebugSession, this);
    }
    onDidStartDebugSession(eventData) {
        this.activeDebugSessions.push(eventData);
        this.emit(DebugManager.debugSessionsChangedEvent);
    }
    onDidTerminateDebugSession(eventData) {
        const index = this.activeDebugSessions.findIndex(ds => ds.id === eventData.id);
        if (index >= 0) {
            this.activeDebugSessions.splice(index, 1);
            this.emit(DebugManager.debugSessionsChangedEvent);
        }
    }
}
DebugManager.debugSessionsChangedEvent = 'debugSessionsChanged';
exports.DebugManager = DebugManager;

//# sourceMappingURL=debugManager.js.map
