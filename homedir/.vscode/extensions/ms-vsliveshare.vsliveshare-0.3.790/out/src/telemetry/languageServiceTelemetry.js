"use strict";
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
Object.defineProperty(exports, "__esModule", { value: true });
const telemetry_1 = require("./telemetry");
const telemetryStrings_1 = require("./telemetryStrings");
class LanguageServiceTelemetryEventNames {
}
LanguageServiceTelemetryEventNames.LSPSERVER_INIT_FAULT = telemetryStrings_1.TelemetryEventNames.FAULT_PREFIX + 'init-lspserver-fault';
LanguageServiceTelemetryEventNames.SUMMARIZE_LSREQUESTS = 'summarize-lsrequests';
LanguageServiceTelemetryEventNames.GET_DIAGNOSTICS_FAULT = telemetryStrings_1.TelemetryEventNames.FAULT_PREFIX + 'get-diagnostics-fault';
LanguageServiceTelemetryEventNames.RESET_LANGUAGE_SERVICES = 'reset-languageservices';
exports.LanguageServiceTelemetryEventNames = LanguageServiceTelemetryEventNames;
class LanuageServiceTelemetryPropertyNames {
}
LanuageServiceTelemetryPropertyNames.SERVICED_REQUESTS = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'ServicedRequests';
LanuageServiceTelemetryPropertyNames.REJECTED_REQUESTS = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'RejectedRequests';
LanuageServiceTelemetryPropertyNames.UNACKNOWLEDGED_HOST_CHANGES_REJECTS = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'UnacknowledgedHostChangesRejects';
exports.LanuageServiceTelemetryPropertyNames = LanuageServiceTelemetryPropertyNames;
function summarizeLsRequests(servicedRequests, rejectedReqests, unacknowledgedHostChangesRejects) {
    let summaryEvent = new telemetry_1.TelemetryEvent(LanguageServiceTelemetryEventNames.SUMMARIZE_LSREQUESTS);
    summaryEvent.addMeasure(LanuageServiceTelemetryPropertyNames.SERVICED_REQUESTS, servicedRequests);
    summaryEvent.addMeasure(LanuageServiceTelemetryPropertyNames.REJECTED_REQUESTS, rejectedReqests);
    summaryEvent.addMeasure(LanuageServiceTelemetryPropertyNames.UNACKNOWLEDGED_HOST_CHANGES_REJECTS, unacknowledgedHostChangesRejects);
    summaryEvent.send();
}
exports.summarizeLsRequests = summarizeLsRequests;

//# sourceMappingURL=languageServiceTelemetry.js.map
