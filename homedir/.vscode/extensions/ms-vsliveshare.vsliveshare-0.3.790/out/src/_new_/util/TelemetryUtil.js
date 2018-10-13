"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vsls = require("../../contracts/VSLS");
const telemetry_1 = require("../../telemetry/telemetry");
const traceSource_1 = require("../../tracing/traceSource");
const UserError_1 = require("../abstractions/UserError");
const util_1 = require("../../util");
const IndeterminateError_1 = require("../abstractions/IndeterminateError");
const NonBlockingError_1 = require("../abstractions/NonBlockingError");
/**
 * Helper functions for sending telemetry events.
 */
class TelemetryUtil {
    static DeriveTelemetryResultFromErrorCode(error) {
        switch (error.code) {
            case vsls.ErrorCodes.CollaborationSessionGuestRejected:
            case vsls.ErrorCodes.CollaborationSessionGuestCanceled:
            case vsls.ErrorCodes.CollaborationSessionRequestTimedOut:
            case vsls.ErrorCodes.CollaborationSessionNotFound:
                return telemetry_1.TelemetryResult.UserFailure;
            default: { }
        }
    }
    static DeriveTelemetryResultFromErrorType(error) {
        if (error instanceof UserError_1.UserError) {
            return telemetry_1.TelemetryResult.UserFailure;
        }
        if (error instanceof util_1.CancellationError) {
            return telemetry_1.TelemetryResult.Cancel;
        }
        if (error instanceof IndeterminateError_1.IndeterminateError) {
            return telemetry_1.TelemetryResult.IndeterminateFailure;
        }
        if (error instanceof NonBlockingError_1.NonBlockingError) {
            return telemetry_1.TelemetryResult.NonBlockingFailure;
        }
    }
    static DeriveTelemetryResult(error) {
        const resultByCode = TelemetryUtil.DeriveTelemetryResultFromErrorCode(error);
        if (typeof resultByCode !== 'undefined') {
            return resultByCode;
        }
        const resultByType = TelemetryUtil.DeriveTelemetryResultFromErrorType(error);
        if (typeof resultByType !== 'undefined') {
            return resultByType;
        }
        return telemetry_1.TelemetryResult.Failure;
    }
    static DeriveTelemetryTitle(command, result) {
        // TODO: Could auto convert enum to friendly string.
        let category = 'Success';
        if (result === telemetry_1.TelemetryResult.UserFailure) {
            category = 'User Failure';
        }
        else if (result === telemetry_1.TelemetryResult.Cancel) {
            category = 'Cancelled';
        }
        else if (result === telemetry_1.TelemetryResult.IndeterminateFailure) {
            category = 'Indeterminate Failure';
        }
        else if (result === telemetry_1.TelemetryResult.Failure) {
            category = 'Failure';
        }
        else if (result === telemetry_1.TelemetryResult.NonBlockingFailure) {
            category = 'Non Blocking Failure';
        }
        return `${command} ${category}`;
    }
    static BuildTelemetryMessage(command, result, error = undefined) {
        let errorPostfix = '';
        if (error !== undefined) {
            errorPostfix = `: ${error}`;
        }
        return `${this.DeriveTelemetryTitle(command, result)}${errorPostfix}`;
    }
    static MapTelemetryResultToFaultType(result) {
        // TODO: Can we unify on one enum type.
        if (result === telemetry_1.TelemetryResult.UserFailure) {
            return telemetry_1.FaultType.User;
        }
        if (result === telemetry_1.TelemetryResult.Cancel) {
            return null;
        }
        if (result === telemetry_1.TelemetryResult.IndeterminateFailure) {
            return telemetry_1.FaultType.Unknown;
        }
        if (result === telemetry_1.TelemetryResult.Failure) {
            return telemetry_1.FaultType.Error;
        }
        if (result === telemetry_1.TelemetryResult.NonBlockingFailure) {
            return telemetry_1.FaultType.NonBlockingFault;
        }
    }
    static MapTelemetryResultToTraceEventType(result) {
        return result === telemetry_1.TelemetryResult.Success ? traceSource_1.TraceEventType.Information : traceSource_1.TraceEventType.Error;
    }
}
exports.TelemetryUtil = TelemetryUtil;

//# sourceMappingURL=TelemetryUtil.js.map
