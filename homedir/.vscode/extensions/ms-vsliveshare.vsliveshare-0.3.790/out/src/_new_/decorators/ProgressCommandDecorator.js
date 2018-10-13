"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DecoratorHelper_1 = require("../util/DecoratorHelper");
const Dependencies_1 = require("../Dependencies");
const util_1 = require("../../util");
function progressCommandDecorator() {
    return DecoratorHelper_1.DecoratorHelper.setupDecorator((command) => new ProgressCommandDecorator(DecoratorHelper_1.DecoratorHelper.getCoreCommand(command), command, Dependencies_1.dependencies.progressNotifierUtil()));
}
exports.progressCommandDecorator = progressCommandDecorator;
/**
 * Progress `decorator` that executes progress func prior to running
 * core command.
 */
class ProgressCommandDecorator {
    constructor(command, next, progressNotifierUtil) {
        this.command = command;
        this.next = next;
        this.progressNotifierUtil = progressNotifierUtil;
    }
    async invoke(options, context) {
        let result = undefined;
        const { cancellationTokenSource } = context;
        const commandCancellationToken = cancellationTokenSource && cancellationTokenSource.token;
        result = await this.progressNotifierUtil.create({ title: context.commandName }, commandCancellationToken, async (progressUIcancellationToken) => {
            /*
                Since we have to listen to the `progressUIcancellationToken.onCancellationRequested` and
                throwing inside the callback will swallow the error(because at time of exception, the callback will be on the top of the call stack),
                we need this explicit Promise `reject` to be able to bubble up the error.
            */
            return new Promise(async (resolve, reject) => {
                const cancel = () => {
                    reject(new util_1.CancellationError(`The operation was cancelled.`));
                };
                if (progressUIcancellationToken) {
                    if (progressUIcancellationToken.isCancellationRequested) {
                        cancel();
                    }
                    progressUIcancellationToken.onCancellationRequested(() => {
                        cancel();
                    });
                }
                if (cancellationTokenSource && commandCancellationToken) {
                    if (commandCancellationToken.isCancellationRequested) {
                        cancel();
                    }
                    commandCancellationToken.onCancellationRequested(() => {
                        cancel();
                    });
                }
                try {
                    resolve(await this.next.invoke(options, context));
                }
                catch (e) {
                    reject(e);
                }
            });
        });
        return result;
    }
}
exports.ProgressCommandDecorator = ProgressCommandDecorator;

//# sourceMappingURL=ProgressCommandDecorator.js.map
