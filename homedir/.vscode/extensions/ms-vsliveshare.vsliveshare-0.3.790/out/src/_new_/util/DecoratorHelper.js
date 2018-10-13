"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MetaProfilingCommandDecorator_1 = require("../decorators/MetaProfilingCommandDecorator");
class DecoratorHelper {
    static getCoreCommand(command) {
        const decorator = command;
        if (decorator.next) {
            return DecoratorHelper.getCoreCommand(decorator.next);
        }
        return decorator;
    }
    static setupDecorator(builder) {
        // TODO: Could have a switch here to bypass profiling at in prod if we wanted
        return DecoratorHelper.setupDecoratorInner((command) => DecoratorHelper.buildMetaProfilingCommandDecorator(builder(command)));
    }
    static setupDecoratorInner(builder) {
        return (original) => {
            const f = function (...args) {
                const next = original.name === 'f'
                    ? original.apply(this, args)
                    : DecoratorHelper.buildMetaProfilingCommandDecorator(new original(...args));
                return builder(next);
            };
            f.prototype = original.prototype;
            return f;
        };
    }
    static buildMetaProfilingCommandDecorator(command) {
        return new MetaProfilingCommandDecorator_1.MetaProfilingCommandDecorator(DecoratorHelper.getCoreCommand(command), command);
    }
}
exports.DecoratorHelper = DecoratorHelper;

//# sourceMappingURL=DecoratorHelper.js.map
