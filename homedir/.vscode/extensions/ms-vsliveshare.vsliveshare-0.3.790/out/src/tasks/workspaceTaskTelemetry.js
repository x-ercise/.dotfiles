"use strict";
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
Object.defineProperty(exports, "__esModule", { value: true });
const telemetry_1 = require("../telemetry/telemetry");
const telemetryStrings_1 = require("../telemetry/telemetryStrings");
class WorkspaceTaskTelemetry {
    static sendExecutionSummary(taskKind, executionTimes) {
        let summaryEvent = new telemetry_1.TelemetryEvent(EventNames.EXECUTE_SHARED_TASK);
        summaryEvent.addProperty(PropertyNames.TASK_KIND, taskKind);
        summaryEvent.addMeasure(PropertyNames.TOTAL_COUNT, executionTimes.length);
        summaryEvent.addMeasure(PropertyNames.MAX_TIME, Math.max(...executionTimes));
        summaryEvent.addMeasure(PropertyNames.MIN_TIME, Math.min(...executionTimes));
        summaryEvent.addMeasure(PropertyNames.AVERAGE_TIME, executionTimes.reduce((p, c) => p + c, 0) / executionTimes.length);
        summaryEvent.send();
    }
}
WorkspaceTaskTelemetry.FEATURE_PREFIX = 'WorkspaceTask/';
WorkspaceTaskTelemetry.PROPERTY_PREFIX = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'WorkspaceTask.';
exports.WorkspaceTaskTelemetry = WorkspaceTaskTelemetry;
class EventNames {
}
EventNames.EXECUTE_SHARED_TASK = 'execute-task';
EventNames.TASK_EXECUTION_ERROR = telemetryStrings_1.TelemetryEventNames.FAULT_PREFIX + 'execute-task-error';
class PropertyNames {
}
PropertyNames.TASK_KIND = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'TaskKind';
PropertyNames.TOTAL_COUNT = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'TotalCount';
PropertyNames.MAX_TIME = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'MaxTime';
PropertyNames.MIN_TIME = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'MinTime';
PropertyNames.AVERAGE_TIME = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'AverageTime';

//# sourceMappingURL=workspaceTaskTelemetry.js.map
