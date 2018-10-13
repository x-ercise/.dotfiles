"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DecoratorHelper_1 = require("../util/DecoratorHelper");
function validationCommandDecorator() {
    return DecoratorHelper_1.DecoratorHelper.setupDecorator((command) => new ValidationCommandDecorator(DecoratorHelper_1.DecoratorHelper.getCoreCommand(command), command));
}
exports.validationCommandDecorator = validationCommandDecorator;
/**
 * Validation `decorator` that executes validation func prior to running
 * core command.
 */
class ValidationCommandDecorator {
    constructor(command, next) {
        this.command = command;
        this.next = next;
    }
    async invoke(options, context) {
        let result = undefined;
        let validator = this.command;
        if (validator.validate) {
            validator.validate(options, context);
        }
        result = await this.next.invoke(options, context);
        return result;
    }
}
exports.ValidationCommandDecorator = ValidationCommandDecorator;

//# sourceMappingURL=ValidationCommandDecorator.js.map
