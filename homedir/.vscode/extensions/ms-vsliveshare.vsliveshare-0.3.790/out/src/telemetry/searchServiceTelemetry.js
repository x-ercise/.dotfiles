"use strict";
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
Object.defineProperty(exports, "__esModule", { value: true });
const telemetry_1 = require("./telemetry");
const telemetryStrings_1 = require("./telemetryStrings");
class FileSearchTelemetry {
    static sendFindFileDiagnostics(fileCount, useIgnoreFiles) {
        const summaryEvent = new telemetry_1.TelemetryEvent(SearchServiceTelemetryEventNames.FIND_FILE);
        summaryEvent.addMeasure(SearchServiceTelemetryPropertyNames.FILE_COUNT, fileCount);
        summaryEvent.addProperty(SearchServiceTelemetryPropertyNames.USE_IGNORE_FILES, useIgnoreFiles);
        summaryEvent.send();
    }
}
FileSearchTelemetry.PROPERTY_PREFIX = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'Search.';
exports.FileSearchTelemetry = FileSearchTelemetry;
class TextSearchTelemetry {
    startTextSearch() {
        this.textSearchEvent = new telemetry_1.TimedEvent(SearchServiceTelemetryEventNames.TEXT_SEARCH);
    }
    saveTextSearchResults(resultsCount) {
        this.textSearchEvent.addMeasure(SearchServiceTelemetryPropertyNames.RESULTS_COUNT, resultsCount);
        this.textSearchEvent.markTime(SearchServiceTelemetryPropertyNames.RESULTS_RECEIVED_TIME);
    }
    sendTextSearchDiagnostics() {
        this.textSearchEvent.markTime(SearchServiceTelemetryPropertyNames.RESULTS_REPORTED_TIME);
        this.textSearchEvent.send();
    }
}
TextSearchTelemetry.PROPERTY_PREFIX = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'Search.';
exports.TextSearchTelemetry = TextSearchTelemetry;
class SearchServiceTelemetryEventNames {
}
SearchServiceTelemetryEventNames.FIND_FILE_FAULT = 'find-file-fault';
SearchServiceTelemetryEventNames.FIND_FILE = 'find-file';
SearchServiceTelemetryEventNames.TEXT_SEARCH = 'find-text';
exports.SearchServiceTelemetryEventNames = SearchServiceTelemetryEventNames;
class SearchServiceTelemetryPropertyNames {
}
SearchServiceTelemetryPropertyNames.FILE_COUNT = FileSearchTelemetry.PROPERTY_PREFIX + 'FileCount';
SearchServiceTelemetryPropertyNames.USE_IGNORE_FILES = FileSearchTelemetry.PROPERTY_PREFIX + 'UseIgnoreFiles';
SearchServiceTelemetryPropertyNames.RESULTS_RECEIVED_TIME = TextSearchTelemetry.PROPERTY_PREFIX + 'ResultsReceivedTime';
SearchServiceTelemetryPropertyNames.RESULTS_COUNT = TextSearchTelemetry.PROPERTY_PREFIX + 'ResultsCount';
SearchServiceTelemetryPropertyNames.RESULTS_REPORTED_TIME = TextSearchTelemetry.PROPERTY_PREFIX + 'ResultsReportedTime';

//# sourceMappingURL=searchServiceTelemetry.js.map
