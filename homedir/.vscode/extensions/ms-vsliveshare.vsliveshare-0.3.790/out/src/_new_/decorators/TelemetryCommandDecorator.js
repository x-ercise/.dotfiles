"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const telemetry_1 = require("../../telemetry/telemetry");
const vsls = require("../../contracts/VSLS");
const DecoratorHelper_1 = require("../util/DecoratorHelper");
const TelemetryUtil_1 = require("../util/TelemetryUtil");
const Dependencies_1 = require("../Dependencies");
const telemetryStrings_1 = require("../../telemetry/telemetryStrings");
function telemetryCommandDecorator(telemetryEventName, telemetryFaultEventName, telemetryTitle, telemetryEventVersion, onError) {
    return DecoratorHelper_1.DecoratorHelper.setupDecorator((command) => new TelemetryCommandDecorator(DecoratorHelper_1.DecoratorHelper.getCoreCommand(command), command, Dependencies_1.dependencies.workspaceService(), Dependencies_1.dependencies.telemetry(), telemetryEventName, telemetryFaultEventName, telemetryTitle, telemetryEventVersion, onError));
}
exports.telemetryCommandDecorator = telemetryCommandDecorator;
/**
 * Instrumentation `commandHandler` that automatically sets up any
 * default telemetry and tracing for a given command.
 */
class TelemetryCommandDecorator {
    constructor(command, next, workspaceService, telemetry, telemetryEventName, telemetryFaultEventName, telemetryTitle, telemetryEventVersion, onError) {
        this.command = command;
        this.next = next;
        this.workspaceService = workspaceService;
        this.telemetry = telemetry;
        this.telemetryEventName = telemetryEventName;
        this.telemetryFaultEventName = telemetryFaultEventName;
        this.telemetryTitle = telemetryTitle;
        this.telemetryEventVersion = telemetryEventVersion;
        this.onError = onError;
    }
    async invoke(options, context) {
        let result = undefined;
        let error = undefined;
        let telemetryEvent = this.telemetry.startTimedEvent(this.telemetryEventName);
        let telemetryResult = undefined;
        let telemetryMessage = undefined;
        context.telemetryEvent = telemetryEvent;
        this.telemetry.setCorrelationEvent(telemetryEvent);
        telemetryEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.COMMAND_TEXT, context.commandText);
        telemetryEvent.addMeasure(telemetryStrings_1.TelemetryPropertyNames.TELEMETRY_EVENT_VERSION, this.telemetryEventVersion);
        this.workspaceService.onProgressUpdated(this.onWorkspaceProgressUpdated.bind(this, telemetryEvent));
        try {
            result = await this.next.invoke(options, context);
        }
        catch (e) {
            telemetryResult = TelemetryUtil_1.TelemetryUtil.DeriveTelemetryResult(e);
            telemetryMessage = TelemetryUtil_1.TelemetryUtil.BuildTelemetryMessage(this.telemetryTitle, telemetryResult, e.message);
            if (this.onError) {
                this.onError(e, context);
            }
            this.telemetry.sendFault(this.telemetryFaultEventName, TelemetryUtil_1.TelemetryUtil.MapTelemetryResultToFaultType(telemetryResult), telemetryMessage, e);
            error = e;
            throw e;
        }
        finally {
            telemetryMessage = telemetryMessage || TelemetryUtil_1.TelemetryUtil.BuildTelemetryMessage(this.telemetryTitle, telemetry_1.TelemetryResult.Success);
            const duration = telemetryEvent.end(telemetryResult, telemetryMessage);
            context.trace.traceEvent(TelemetryUtil_1.TelemetryUtil.MapTelemetryResultToTraceEventType(telemetryResult), 0, `Command [${context.commandName}]: ${telemetryMessage} (${duration}ms)`);
            // noting that we have logged the error. We will check this up stream
            if (error) {
                error.hasRecorded = true;
            }
        }
        return result;
    }
    onWorkspaceProgressUpdated(e, telemetryEvent) {
        switch (e.progress) {
            case vsls.WorkspaceProgress.WaitingForHost: {
                telemetryEvent.markTime(telemetryStrings_1.TelemetryPropertyNames.START_WAITING_FOR_HOST);
                break;
            }
            case vsls.WorkspaceProgress.DoneWaitingForHost: {
                telemetryEvent.markTime(telemetryStrings_1.TelemetryPropertyNames.DONE_WAITING_FOR_HOST);
                break;
            }
            default: { }
        }
    }
}
exports.TelemetryCommandDecorator = TelemetryCommandDecorator;

//# sourceMappingURL=TelemetryCommandDecorator.js.map
