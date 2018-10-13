"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Instrumentation other pieces of middleware.
 */
class MetaProfilingCommandDecorator {
    constructor(command, next) {
        this.command = command;
        this.next = next;
        this.friendlyName = (this.next && this.next.constructor && this.next.constructor.name).replace('CommandDecorator', '');
    }
    async invoke(options, context) {
        let result = undefined;
        let hasError = false;
        MetaProfilingCommandDecorator.setPreTime();
        context.trace.info(`Decorator: ${this.friendlyName} Starting`);
        try {
            result = await this.next.invoke(options, context);
        }
        catch (e) {
            hasError = true;
            throw e;
        }
        finally {
            const tailTiming = MetaProfilingCommandDecorator.timeTail;
            const timing = MetaProfilingCommandDecorator.setPostTime();
            const duration = timing.post - timing.pre;
            const errorText = hasError ? 'Failed' : 'Success';
            let durationText = '';
            if (tailTiming) {
                const preDuration = tailTiming.pre - timing.pre;
                const postDuration = timing.post - tailTiming.post;
                durationText = ` abs=${preDuration + postDuration}ms pre=${preDuration}ms post=${postDuration}`;
            }
            context.trace.info(`Decorator: ${this.friendlyName} Completed ${errorText} (${duration}ms${durationText})`);
        }
        return result;
    }
    static setPreTime() {
        const timing = {
            pre: new Date().getTime()
        };
        MetaProfilingCommandDecorator.timeTracker.push(timing);
        return timing;
    }
    static setPostTime() {
        const timing = MetaProfilingCommandDecorator.timeTracker.pop();
        timing.post = new Date().getTime();
        MetaProfilingCommandDecorator.timeTail = timing;
        return timing;
    }
}
MetaProfilingCommandDecorator.timeTracker = [];
exports.MetaProfilingCommandDecorator = MetaProfilingCommandDecorator;

//# sourceMappingURL=MetaProfilingCommandDecorator.js.map
