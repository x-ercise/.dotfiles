"use strict";
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
Object.defineProperty(exports, "__esModule", { value: true });
const telemetry_1 = require("./telemetry");
const telemetryStrings_1 = require("./telemetryStrings");
class RemoteServiceTelemetry {
    static sendRequestSummary(serviceName, methodName, responseTimes) {
        let summaryEvent = new telemetry_1.TelemetryEvent(EventNames.SERVICE_REQUEST);
        summaryEvent.addProperty(PropertyNames.SERVICE_NAME, serviceName);
        summaryEvent.addProperty(PropertyNames.METHOD_NAME, methodName);
        summaryEvent.addMeasure(PropertyNames.TOTAL_COUNT, responseTimes.length);
        summaryEvent.addMeasure(PropertyNames.MAX_TIME, Math.max(...responseTimes));
        summaryEvent.addMeasure(PropertyNames.MIN_TIME, Math.min(...responseTimes));
        summaryEvent.addMeasure(PropertyNames.AVERAGE_TIME, responseTimes.reduce((p, c) => p + c, 0) / responseTimes.length);
        summaryEvent.send();
    }
    static sendServiceFault(serviceName, methodName, error) {
        telemetry_1.Instance.sendFault(EventNames.HANDLE_REQUEST_ERROR, telemetry_1.FaultType.Error, `Error processing a service request '${serviceName}.${methodName}'. ${error.message}`, error);
    }
    static sendClientFault(serviceName, methodName, error) {
        telemetry_1.Instance.sendFault(EventNames.SEND_REQUEST_ERROR, telemetry_1.FaultType.Error, `Error sending a remote service request '${serviceName}.${methodName}'. ${error.message}`, error);
    }
}
RemoteServiceTelemetry.FEATURE_PREFIX = 'RemoteService/';
RemoteServiceTelemetry.PROPERTY_PREFIX = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'RemoteService.';
exports.RemoteServiceTelemetry = RemoteServiceTelemetry;
class EventNames {
}
EventNames.SERVICE_REQUEST = 'service-request';
EventNames.HANDLE_REQUEST_ERROR = telemetryStrings_1.TelemetryEventNames.FAULT_PREFIX + 'handle-request-error';
EventNames.SEND_REQUEST_ERROR = telemetryStrings_1.TelemetryEventNames.FAULT_PREFIX + 'send-request-error';
class PropertyNames {
}
PropertyNames.SERVICE_NAME = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'ServiceName';
PropertyNames.METHOD_NAME = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'MethodName';
PropertyNames.TOTAL_COUNT = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'TotalCount';
PropertyNames.MAX_TIME = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'MaxTime';
PropertyNames.MIN_TIME = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'MinTime';
PropertyNames.AVERAGE_TIME = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'AverageTime';

//# sourceMappingURL=remoteServiceTelemetry.js.map
