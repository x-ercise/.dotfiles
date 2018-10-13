"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
const telemetry_1 = require("./telemetry");
const telemetryStrings_1 = require("./telemetryStrings");
class PortForwardingTelemetry {
    static listSharedLocalServers(origin) {
        PortForwardingTelemetry.sendEvent(Event.LIST_SHARED_LOCAL_SERVERS, origin);
    }
    static shareServer(sourcePort, origin) {
        PortForwardingTelemetry.sendEvent(Event.SHARE_SERVER, origin, sourcePort);
    }
    static unshareServer(sourcePort, origin) {
        PortForwardingTelemetry.sendEvent(Event.UNSHARE_SERVER, origin, sourcePort);
    }
    static sendEvent(eventName, origin, sourcePort) {
        const event = new telemetry_1.TelemetryEvent(eventName);
        event.addProperty(Property.ORIGIN, EventOrigin[origin || EventOrigin.Command]);
        if (sourcePort) {
            event.addProperty(Property.SOURCE_PORT, sourcePort.toString());
        }
        event.send();
    }
}
PortForwardingTelemetry.FEATURE_PREFIX = 'PortForwarding/';
PortForwardingTelemetry.PROPERTY_PREFIX = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'PortForwarding.';
exports.PortForwardingTelemetry = PortForwardingTelemetry;
var EventOrigin;
(function (EventOrigin) {
    EventOrigin[EventOrigin["StatusBar"] = 0] = "StatusBar";
    EventOrigin[EventOrigin["Command"] = 1] = "Command";
})(EventOrigin = exports.EventOrigin || (exports.EventOrigin = {}));
class Event {
}
/// <summary>
/// User lists shared local servers.
/// </summary>
Event.LIST_SHARED_LOCAL_SERVERS = PortForwardingTelemetry.FEATURE_PREFIX + 'list-shareLocalServers';
/// <summary>
/// User shares a local server.
/// </summary>
Event.SHARE_SERVER = PortForwardingTelemetry.FEATURE_PREFIX + 'share-server';
/// <summary>
/// User unshares a local server.
/// </summary>
Event.UNSHARE_SERVER = PortForwardingTelemetry.FEATURE_PREFIX + 'unshare-server';
class Property {
}
/// <summary>
/// Task or operation origin.
/// </summary>
Property.ORIGIN = PortForwardingTelemetry.PROPERTY_PREFIX + 'Origin';
/// <summary>
/// Local port being forwarded from
/// </summary>
Property.SOURCE_PORT = PortForwardingTelemetry.PROPERTY_PREFIX + 'SourcePort';

//# sourceMappingURL=portForwardingTelemetry.js.map
