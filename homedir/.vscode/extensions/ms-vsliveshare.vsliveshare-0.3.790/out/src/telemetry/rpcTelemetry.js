"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const telemetry_1 = require("./telemetry");
const rpcUtils_1 = require("../utils/rpcUtils");
const telemetryStrings_1 = require("./telemetryStrings");
class MethodTimingSummary {
    constructor() {
        this.numRequests = 0;
        this.firstRequestTime = 0;
        this.maxRequestTime = 0;
        this.minRequestTime = 0;
        this.totalRequestTimes = 0;
    }
    get averageRequestTime() {
        return (this.numRequests === 0) ? 0 : (this.totalRequestTimes / this.numRequests);
    }
    addRequestTime(requestTime) {
        if (this.numRequests === 0) {
            this.firstRequestTime = this.maxRequestTime = this.minRequestTime = requestTime;
        }
        else {
            this.maxRequestTime = Math.max(requestTime, this.maxRequestTime);
            this.minRequestTime = Math.min(requestTime, this.minRequestTime);
        }
        this.numRequests++;
        this.totalRequestTimes += requestTime;
    }
}
class MethodRequestSummary {
    constructor() {
        this.latencySummary = new MethodTimingSummary();
        this.processingSummary = new MethodTimingSummary();
        this.combinedSummary = new MethodTimingSummary();
    }
}
class RpcTelemetry {
    static updateTelemetry(methodName, latency, processingTime, combinedTime) {
        if (!RpcTelemetry.requestSummaries.has(methodName)) {
            RpcTelemetry.requestSummaries.set(methodName, new MethodRequestSummary());
        }
        const requestSummary = RpcTelemetry.requestSummaries.get(methodName);
        requestSummary.latencySummary.addRequestTime(latency);
        requestSummary.processingSummary.addRequestTime(processingTime);
        requestSummary.combinedSummary.addRequestTime(combinedTime);
    }
    static postRequestSummaries() {
        for (const [method, methodRequestSummary] of RpcTelemetry.requestSummaries) {
            const rpcSummaryEvent = new telemetry_1.TelemetryEvent(RpcTelemetryEventNames.SUMMARIZE_RPC_REQUESTS);
            rpcSummaryEvent.addProperty(RpcTelemetryPropertyNames.METHOD_NAME, method);
            rpcSummaryEvent.addMeasure(RpcTelemetryPropertyNames.NUMBER_OF_REQUESTS, methodRequestSummary.latencySummary.numRequests);
            rpcSummaryEvent.addProperty(RpcTelemetryPropertyNames.FIRST_REQUEST_TIME, JSON.stringify([methodRequestSummary.latencySummary.firstRequestTime, methodRequestSummary.processingSummary.firstRequestTime, methodRequestSummary.combinedSummary.firstRequestTime]));
            rpcSummaryEvent.addProperty(RpcTelemetryPropertyNames.MAX_REQUEST_TIME, JSON.stringify([methodRequestSummary.latencySummary.maxRequestTime, methodRequestSummary.processingSummary.maxRequestTime, methodRequestSummary.combinedSummary.maxRequestTime]));
            rpcSummaryEvent.addProperty(RpcTelemetryPropertyNames.MIN_REQUEST_TIME, JSON.stringify([methodRequestSummary.latencySummary.minRequestTime, methodRequestSummary.processingSummary.minRequestTime, methodRequestSummary.combinedSummary.minRequestTime]));
            rpcSummaryEvent.addProperty(RpcTelemetryPropertyNames.AVERAGE_REQUEST_TIME, JSON.stringify([methodRequestSummary.latencySummary.averageRequestTime, methodRequestSummary.processingSummary.averageRequestTime, methodRequestSummary.combinedSummary.averageRequestTime]));
            rpcSummaryEvent.send();
        }
        RpcTelemetry.requestSummaries.clear();
    }
}
RpcTelemetry.requestSummaries = new Map();
exports.RpcTelemetry = RpcTelemetry;
class LanguageServiceRpcMethodNameProvider {
    constructor() {
        this.serviceNames = ['languageServerProvider-any', 'languageServerProvider-Roslyn'];
    }
    getRequestMethod(msg) {
        if (msg.params && msg.params.length > 0 && msg.method && msg.params[0].method) {
            const serviceName = msg.method.split('.')[0];
            return serviceName + '.' + msg.params[0].method;
        }
        return undefined;
    }
}
exports.LanguageServiceRpcMethodNameProvider = LanguageServiceRpcMethodNameProvider;
class TelemetryRpcFilter {
    constructor(...methodNameProviders) {
        // Map from message ids to request messages
        this.requestMessages = new Map();
        this.methodNameProviders = new Map();
        for (const mnp of methodNameProviders) {
            this.addMethodNameProvider(mnp);
        }
    }
    addMethodNameProvider(provider) {
        for (const serviceName of provider.serviceNames) {
            this.methodNameProviders.set(serviceName, provider);
        }
    }
    writeFilter(msg) {
        if (typeof msg.id !== 'undefined') {
            this.requestMessages.set(msg.id, msg);
        }
        return msg;
    }
    readFilter(msg) {
        if ((typeof msg.id !== 'undefined') && (typeof msg.times !== 'undefined') && (this.requestMessages.has(msg.id))) {
            const requestMessage = this.requestMessages.get(msg.id);
            this.requestMessages.delete(msg.id);
            if (requestMessage.method) {
                let methodName = requestMessage.method;
                const serviceName = methodName.split('.')[0];
                if (this.methodNameProviders.has(serviceName)) {
                    const modifiedMethodName = this.methodNameProviders.get(serviceName).getRequestMethod(requestMessage);
                    methodName = modifiedMethodName ? modifiedMethodName : methodName;
                }
                RpcTelemetry.updateTelemetry(methodName, rpcUtils_1.TimedRpcMessageUtils.getLatency(msg.times), rpcUtils_1.TimedRpcMessageUtils.getProcessingTime(msg.times), rpcUtils_1.TimedRpcMessageUtils.getTotalTime(msg.times));
            }
        }
        return msg;
    }
}
exports.TelemetryRpcFilter = TelemetryRpcFilter;
class RpcTelemetryEventNames {
}
RpcTelemetryEventNames.SUMMARIZE_RPC_REQUESTS = 'summarize-rpcrequests';
exports.RpcTelemetryEventNames = RpcTelemetryEventNames;
class RpcTelemetryPropertyNames {
}
RpcTelemetryPropertyNames.METHOD_NAME = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'TelemetryPropertyNames.FEATURE_NAMEMethodName';
RpcTelemetryPropertyNames.NUMBER_OF_REQUESTS = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'NumberOfRequests';
RpcTelemetryPropertyNames.FIRST_REQUEST_TIME = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'FirstRequestTime';
RpcTelemetryPropertyNames.MAX_REQUEST_TIME = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'MaxRequestTime';
RpcTelemetryPropertyNames.MIN_REQUEST_TIME = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'MinRequestTime';
RpcTelemetryPropertyNames.AVERAGE_REQUEST_TIME = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'AverageRequestTime';
exports.RpcTelemetryPropertyNames = RpcTelemetryPropertyNames;

//# sourceMappingURL=rpcTelemetry.js.map
