"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const DecoratorHelper_1 = require("../util/DecoratorHelper");
function cancellationDecorator() {
    return DecoratorHelper_1.DecoratorHelper.setupDecorator((command) => {
        return new CancellationDecorator(DecoratorHelper_1.DecoratorHelper.getCoreCommand(command), command);
    });
}
exports.cancellationDecorator = cancellationDecorator;
/**
 * Cancellation Token decorator is responsible for setting up the cancellation token for the entire command flow and
 * cancelling a previous command cancellation token, if present.
 */
class CancellationDecorator {
    constructor(command, next) {
        this.command = command;
        this.next = next;
    }
    cancelPreviousCommandIfRunning() {
        const currentCancellationTokenSource = CancellationDecorator.currentCancellationTokenSource;
        const commandCancellationToken = currentCancellationTokenSource && currentCancellationTokenSource.token;
        if (commandCancellationToken && !commandCancellationToken.isCancellationRequested) {
            currentCancellationTokenSource.cancel();
        }
    }
    async invoke(options, context) {
        // cancel the previous command if running
        this.cancelPreviousCommandIfRunning();
        // set the cancellation token to the command context
        CancellationDecorator.currentCancellationTokenSource = new vscode_1.CancellationTokenSource();
        context.cancellationTokenSource = CancellationDecorator.currentCancellationTokenSource;
        return await this.next.invoke(options, context);
    }
}
exports.CancellationDecorator = CancellationDecorator;

//# sourceMappingURL=CancellationDecorator.js.map
