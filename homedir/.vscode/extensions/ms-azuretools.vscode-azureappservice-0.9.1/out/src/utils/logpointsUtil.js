"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const timers_1 = require("timers");
exports.DEFAULT_TIMEOUT = 20000;
// tslint:disable-next-line:export-name
// tslint:disable-next-line:no-any
function callWithTimeout(proc, timeout) {
    return new Promise((resolve, reject) => {
        const timer = timers_1.setTimeout(() => {
            reject(new Error(`Invocation timed out after ${timeout} milliseconds.`));
        }, timeout);
        if (!proc) {
            reject("Procedure cannot be null");
        }
        proc().then((result) => {
            clearTimeout(timer);
            resolve(result);
        });
    });
}
exports.callWithTimeout = callWithTimeout;
//# sourceMappingURL=logpointsUtil.js.map