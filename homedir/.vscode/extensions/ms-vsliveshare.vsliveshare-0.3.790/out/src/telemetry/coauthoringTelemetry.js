"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
const telemetry_1 = require("./telemetry");
const telemetryStrings_1 = require("./telemetryStrings");
class CoauthoringTelemetry {
    static BufferClosed(contentType, numLocalEdits, numRemoteEdits, editTransitionTimes, numLocalUndos, numRemoteUndos, numHighlights, avgLatency) {
        const bufferClosedEvent = new telemetry_1.TelemetryEvent(Event.BUFFER_CLOSED);
        bufferClosedEvent.addProperty(Property.CONTENT_TYPE, contentType);
        bufferClosedEvent.addMeasure(Property.NUMBER_OF_LOCAL_EDITS, numLocalEdits);
        bufferClosedEvent.addMeasure(Property.NUMBER_OF_REMOTE_EDITS, numRemoteEdits);
        bufferClosedEvent.addProperty(Property.NUMBER_OF_HIGH_DENSITY_EDITS, JSON.stringify(editTransitionTimes));
        bufferClosedEvent.addMeasure(Property.NUMBER_OF_LOCAL_UNDOS, numLocalUndos);
        bufferClosedEvent.addMeasure(Property.NUMBER_OF_REMOTE_UNDOS, numRemoteUndos);
        // The following properties are not currently supported
        // bufferClosedEvent.addMeasure(Property.NUMBER_OF_HIGHLIGHTS, numHighlights);
        // bufferClosedEvent.addMeasure(Property.AVERAGE_LATENCY, avgLatency);
        bufferClosedEvent.send();
    }
    static SessionClosed(numJumpTos, numFailedJumpTos, numPins, numUnpins, numAutoUnpins) {
        const sessionClosedEvent = new telemetry_1.TelemetryEvent(Event.SESSION_CLOSED);
        sessionClosedEvent.addMeasure(Property.NUMBER_OF_JUMP_TOS, numJumpTos);
        sessionClosedEvent.addMeasure(Property.NUMBER_OF_FAILED_JUMP_TOS, numFailedJumpTos);
        sessionClosedEvent.addMeasure(Property.NUMBER_OF_PINS, numPins);
        sessionClosedEvent.addMeasure(Property.NUMBER_OF_EXPLICIT_UNPINS, numUnpins);
        sessionClosedEvent.addMeasure(Property.NUMBER_OF_AUTOMATIC_UNPINS, numAutoUnpins);
        sessionClosedEvent.send();
    }
    static ReportNonFunctionalNavigation(navigation) {
        const nonFunctionalNavigationEvent = new telemetry_1.TelemetryEvent(Event.NON_FUNCTIONAL_NAVIGATION);
        nonFunctionalNavigationEvent.addProperty(Property.NON_FUNCTIONAL_NAVIGATION, NonFunctionalNavigation[navigation]);
        nonFunctionalNavigationEvent.send();
    }
    static ReportDesync(reason) {
        const desyncEvent = new telemetry_1.TelemetryEvent(Event.DESYNC);
        desyncEvent.addProperty(Property.DESYNC_REASON, DesyncReason[reason]);
        desyncEvent.send();
    }
    static ReportCoeditingError(details, exception) {
        (new telemetry_1.Fault(Event.COEDITING_ERROR, telemetry_1.FaultType.Error, details, exception)).send();
    }
}
CoauthoringTelemetry.FEATURE_PREFIX = 'Coauthoring/';
CoauthoringTelemetry.PROPERTY_PREFIX = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'Coauthoring.';
exports.CoauthoringTelemetry = CoauthoringTelemetry;
var NonFunctionalNavigation;
(function (NonFunctionalNavigation) {
    NonFunctionalNavigation[NonFunctionalNavigation["FindInFiles"] = 0] = "FindInFiles";
})(NonFunctionalNavigation = exports.NonFunctionalNavigation || (exports.NonFunctionalNavigation = {}));
var DesyncReason;
(function (DesyncReason) {
    DesyncReason[DesyncReason["Unknown"] = 0] = "Unknown";
    DesyncReason[DesyncReason["MessagesOutOfOrder"] = 1] = "MessagesOutOfOrder";
})(DesyncReason = exports.DesyncReason || (exports.DesyncReason = {}));
class Event {
}
/// <summary>
/// User tried to perform a navigation action that isn't supported. See NonFunctionalNavigation enum for possibilities
/// </summary>
Event.NON_FUNCTIONAL_NAVIGATION = CoauthoringTelemetry.FEATURE_PREFIX + 'navigate-nonfunctional';
/// <summary>
/// Buffer is closed
/// </summary>
Event.BUFFER_CLOSED = CoauthoringTelemetry.FEATURE_PREFIX + 'close-buffer';
/// <summary>
/// Session is closed
/// </summary>
Event.SESSION_CLOSED = CoauthoringTelemetry.FEATURE_PREFIX + 'close-session';
/// <summary>
/// Coediting detected a potential state of desync
/// </summary>
Event.DESYNC = CoauthoringTelemetry.FEATURE_PREFIX + 'desync-coediting';
/// <summary>
/// An exception occurred while processing a coediting message
/// </summary>
Event.COEDITING_ERROR = CoauthoringTelemetry.FEATURE_PREFIX + 'coedit-processing-error';
/// <summary>
/// We didn't get an acknowledgement for a message sent from the host
/// </summary>
Event.DROPPED_HOST_MESSAGE_FAULT = telemetryStrings_1.TelemetryEventNames.FAULT_PREFIX + 'drop-hostmessage-fault';
exports.Event = Event;
class Property {
}
/// <summary>
/// The content type of the closed buffer
/// </summary>
Property.CONTENT_TYPE = CoauthoringTelemetry.PROPERTY_PREFIX + 'ContentType';
/// <summary>
/// The number of local edits made in a buffer during its life
/// </summary>
Property.NUMBER_OF_LOCAL_EDITS = CoauthoringTelemetry.PROPERTY_PREFIX + 'NumberOfLocalEdits';
/// <summary>
/// The number of remote edits made in a buffer during its life
/// </summary>
Property.NUMBER_OF_REMOTE_EDITS = CoauthoringTelemetry.PROPERTY_PREFIX + 'NumberOfRemoteEdits';
/// <summary>
/// A 'high density edit' is one that takes place a short time (e.g. 1s) after an edit was made by another participant
/// </summary>
Property.NUMBER_OF_HIGH_DENSITY_EDITS = CoauthoringTelemetry.PROPERTY_PREFIX + 'NumberOfHighDensityEdits';
/// <summary>
/// The number of local undos made in a buffer during its life
/// </summary>
Property.NUMBER_OF_LOCAL_UNDOS = CoauthoringTelemetry.PROPERTY_PREFIX + 'NumberOfLocalUndos';
/// <summary>
/// The number of remote undos made in a buffer during its life
/// </summary>
Property.NUMBER_OF_REMOTE_UNDOS = CoauthoringTelemetry.PROPERTY_PREFIX + 'NumberOfRemoteUndos';
/// <summary>
/// The number of highlights made in a buffer during its life
/// </summary>
Property.NUMBER_OF_HIGHLIGHTS = CoauthoringTelemetry.PROPERTY_PREFIX + 'NumberOfHighlights';
/// <summary>
/// The average latency when receiving coauthoring events (measured in ms)
/// </summary>
Property.AVERAGE_LATENCY = CoauthoringTelemetry.PROPERTY_PREFIX + 'AverageLatency';
/// <summary>
/// The number of jump tos made by a participant during a session
/// </summary>
Property.NUMBER_OF_JUMP_TOS = CoauthoringTelemetry.PROPERTY_PREFIX + 'NumberOfJumpTos';
/// <summary>
/// The number of jump tos that failed because the location of the target was unknown
/// </summary>
Property.NUMBER_OF_FAILED_JUMP_TOS = CoauthoringTelemetry.PROPERTY_PREFIX + 'NumberOfFailedJumpTos';
/// <summary>
/// The number of times the local user pinned to a participant
/// </summary>
Property.NUMBER_OF_PINS = CoauthoringTelemetry.PROPERTY_PREFIX + 'NumberOfPins';
/// <summary>
/// The number of times the local user unpinned a participant explicitly (either through the pin button or the command palette)
/// </summary>
Property.NUMBER_OF_EXPLICIT_UNPINS = CoauthoringTelemetry.PROPERTY_PREFIX + 'NumberOfExplicitUnpins';
/// <summary>
/// The number of times the local user got automatically unpinned from a participant (by changing documents, typing, or setting their cursor in the document)
/// </summary>
Property.NUMBER_OF_AUTOMATIC_UNPINS = CoauthoringTelemetry.PROPERTY_PREFIX + 'NumberOfAutomaticUnpins';
/// <summary>
/// Type of unsupported navigation that the user tried to perform
/// </summary>
Property.NON_FUNCTIONAL_NAVIGATION = CoauthoringTelemetry.PROPERTY_PREFIX + 'NonFunctionalNavigation';
/// <summary>
/// Type of unsupported navigation that the user tried to perform
/// </summary>
Property.DESYNC_REASON = CoauthoringTelemetry.PROPERTY_PREFIX + 'DesyncReason';

//# sourceMappingURL=coauthoringTelemetry.js.map
