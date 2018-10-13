"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const telemetry_1 = require("../../telemetry/telemetry");
const UserError_1 = require("../abstractions/UserError");
const util_1 = require("../../util");
const NonBlockingError_1 = require("../abstractions/NonBlockingError");
const DecoratorHelper_1 = require("../util/DecoratorHelper");
const Dependencies_1 = require("../Dependencies");
function errorNotificationCommandDecorator(title, telemetryFaultEventName, onError) {
    return DecoratorHelper_1.DecoratorHelper.setupDecorator((command) => new ErrorNotificationCommandDecorator(DecoratorHelper_1.DecoratorHelper.getCoreCommand(command), command, Dependencies_1.dependencies.stringUtil(), Dependencies_1.dependencies.notificationUtil(), Dependencies_1.dependencies.telemetry(), telemetryFaultEventName, title, onError));
}
exports.errorNotificationCommandDecorator = errorNotificationCommandDecorator;
/**
 * Error Notification `commandHandler` that converts exceptions into the correct
 * notification toast in the client.
 */
class ErrorNotificationCommandDecorator {
    constructor(command, next, stringUtil, notificationUtil, telemetry, telemetryFaultEventName, title, onError) {
        this.command = command;
        this.next = next;
        this.stringUtil = stringUtil;
        this.notificationUtil = notificationUtil;
        this.telemetry = telemetry;
        this.telemetryFaultEventName = telemetryFaultEventName;
        this.title = title;
        this.onError = onError;
    }
    async invoke(options, context) {
        const { cancellationTokenSource } = context;
        let result;
        // save the command name
        context.commandName = this.title;
        try {
            result = await this.next.invoke(options, context);
        }
        catch (error) {
            try {
                let message;
                if (error.code) {
                    message = this.stringUtil.getErrorString(error.code);
                }
                if (!message) {
                    // If message is undefined, set it to exception message.
                    message = error.message;
                }
                const fullMessage = `${context.commandName}: ${message}`;
                // if `CancellationError` was throw, invalidate the cancellation token
                if (error instanceof util_1.CancellationError) {
                    // cancel the command cancellation token if not cancelled yet
                    if (cancellationTokenSource && !cancellationTokenSource.token.isCancellationRequested) {
                        cancellationTokenSource.cancel();
                    }
                }
                if (error instanceof UserError_1.UserError || error instanceof util_1.CancellationError) {
                    this.notificationUtil.showInformationMessage(fullMessage);
                }
                else if (!(error instanceof NonBlockingError_1.NonBlockingError)) {
                    await this.notificationUtil.showErrorMessage(fullMessage);
                }
            }
            catch (e) {
                // if the above block triggered an error we want to know
                error = e;
            }
            // at this this point we will know about any errors that hasn't been
            // recorded - anything thats happened up stream of `TelemetryCommandMiddleware`
            if (error && !error.hasRecorded) {
                const errorMessage = `${context.commandName}: [unhandled exception (decorator)] ${error.message}`;
                context.trace.error(errorMessage);
                this.telemetry.sendFault(this.telemetryFaultEventName, telemetry_1.FaultType.Error, errorMessage, error);
            }
            if (error && this.onError) {
                await this.onError(error, context);
            }
        }
        return result;
    }
}
exports.ErrorNotificationCommandDecorator = ErrorNotificationCommandDecorator;

//# sourceMappingURL=ErrorNotificationCommandDecorator.js.map
