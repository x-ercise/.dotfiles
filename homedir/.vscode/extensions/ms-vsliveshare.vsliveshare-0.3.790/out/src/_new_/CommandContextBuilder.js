"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DecoratorHelper_1 = require("./util/DecoratorHelper");
class CommandContextBuilder {
    constructor(trace) {
        this.trace = trace;
    }
    build(command, commandText, traceName) {
        return {
            trace: this.trace.withName(traceName || this.buildTrace(command)),
            commandText,
            commandName: ''
        };
    }
    buildTrace(command) {
        let name = '';
        command = DecoratorHelper_1.DecoratorHelper.getCoreCommand(command);
        if (command && command.constructor && command.constructor.name) {
            name = command.constructor.name;
            name = name.replace('CommandDecorator', '');
        }
        return `Command:${name}`;
    }
}
exports.CommandContextBuilder = CommandContextBuilder;

//# sourceMappingURL=CommandContextBuilder.js.map
