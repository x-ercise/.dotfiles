"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
var EventReason;
(function (EventReason) {
    EventReason[EventReason["None"] = 1] = "None";
    EventReason[EventReason["Go"] = 2] = "Go";
    EventReason[EventReason["AttachProgram"] = 3] = "AttachProgram";
    EventReason[EventReason["DetachProgram"] = 4] = "DetachProgram";
    EventReason[EventReason["LaunchProgram"] = 5] = "LaunchProgram";
    EventReason[EventReason["EndProgram"] = 6] = "EndProgram";
    EventReason[EventReason["StopDebugging"] = 7] = "StopDebugging";
    EventReason[EventReason["Step"] = 8] = "Step";
    EventReason[EventReason["Breakpoint"] = 9] = "Breakpoint";
    EventReason[EventReason["ExceptionThrown"] = 10] = "ExceptionThrown";
    EventReason[EventReason["ExceptionNotHandled"] = 11] = "ExceptionNotHandled";
    EventReason[EventReason["UserBreak"] = 12] = "UserBreak";
    EventReason[EventReason["ContextSwitch"] = 13] = "ContextSwitch";
})(EventReason = exports.EventReason || (exports.EventReason = {}));
var DebugSourceEventTypes;
(function (DebugSourceEventTypes) {
    DebugSourceEventTypes.debugSessionsSourceId = 'debugSessions';
    DebugSourceEventTypes.debugSessionAddId = 'debugSessionAdd';
    DebugSourceEventTypes.debugSessionRemoveId = 'debugSessionRemove';
})(DebugSourceEventTypes = exports.DebugSourceEventTypes || (exports.DebugSourceEventTypes = {}));
var UIDebugEventTypes;
(function (UIDebugEventTypes) {
    UIDebugEventTypes.enterRunMode = 'enterRunMode';
    UIDebugEventTypes.debugMessage = 'debugMessage';
    UIDebugEventTypes.adapterInitialized = 'adapterInitialized';
})(UIDebugEventTypes = exports.UIDebugEventTypes || (exports.UIDebugEventTypes = {}));
var DebugMessageType;
(function (DebugMessageType) {
    DebugMessageType[DebugMessageType["OutputString"] = 1] = "OutputString";
    DebugMessageType[DebugMessageType["MessageBox"] = 2] = "MessageBox";
    DebugMessageType[DebugMessageType["ReasonException"] = 256] = "ReasonException";
    DebugMessageType[DebugMessageType["ReasonTracepoint"] = 512] = "ReasonTracepoint";
})(DebugMessageType = exports.DebugMessageType || (exports.DebugMessageType = {}));

//# sourceMappingURL=debugEvents.js.map
