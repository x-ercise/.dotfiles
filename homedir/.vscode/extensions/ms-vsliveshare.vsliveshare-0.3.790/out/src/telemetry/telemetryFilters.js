"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const traceSource_1 = require("../tracing/traceSource");
const logFileTraceListener_1 = require("../tracing/logFileTraceListener");
// This filter ensures that only one telemetry event with the given
// event name and set of properties is ever sent. This is useful in
// situations where the same event can be sent many times; e.g. exceptions.
class SendOnceFilter {
    constructor(eventName, distinctProperties = []) {
        this.eventName = eventName;
        this.distinctProperties = distinctProperties;
        this.sentEventsProperties = [];
    }
    shouldSend(eventName, properties, measures) {
        if (eventName === this.eventName) {
            for (const sentProperties of this.sentEventsProperties) {
                if (this.propertySubsetsEqual(properties, sentProperties)) {
                    return false;
                }
            }
            this.sentEventsProperties.push(this.createPropertySubset(properties));
        }
        return true;
    }
    reset() {
        this.sentEventsProperties = [];
    }
    createPropertySubset(properties) {
        const propertySubset = {};
        for (const p of this.distinctProperties) {
            propertySubset[p] = properties[p];
        }
        return propertySubset;
    }
    propertySubsetsEqual(properties1, properties2) {
        for (const p of this.distinctProperties) {
            if (properties1[p] !== properties2[p]) {
                return false;
            }
        }
        return true;
    }
}
exports.SendOnceFilter = SendOnceFilter;
// This filter logs all sent telemetry events to a file.
class LogFilter {
    async init() {
        this.trace = new traceSource_1.TraceSource('Telemetry');
        const logFileTraceListener = new logFileTraceListener_1.LogFileTraceListener('VSCodeTelemetry');
        await logFileTraceListener.openAsync();
        this.trace.addTraceListener(logFileTraceListener);
    }
    shouldSend(eventName, properties, measures) {
        const telemetryEvent = {
            eventName,
            properties,
            measures
        };
        this.trace.info(JSON.stringify(telemetryEvent, null, 2));
        return true;
    }
}
exports.LogFilter = LogFilter;

//# sourceMappingURL=telemetryFilters.js.map
