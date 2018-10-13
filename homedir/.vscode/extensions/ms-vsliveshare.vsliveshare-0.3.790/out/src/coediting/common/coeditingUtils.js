"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
const util_1 = require("../../util");
const traceSource_1 = require("../../tracing/traceSource");
function assert(condition, message) {
    if (!condition) {
        if (util_1.checkDebugging()) {
            // When getting an assert, and we've got a debugger attached, give
            // the engineer a chance to catch it at the point it happens
            // tslint:disable-next-line:no-debugger
            debugger;
        }
        traceSource_1.traceSource.withName(traceSource_1.TraceSources.ClientCoEditing).error(`Assertion Violation: ${message}`);
    }
}
exports.assert = assert;
function makeColorizeFunc(startEscape) {
    return (str) => {
        return startEscape + str + '\x1b[0m';
    };
}
var colorize;
(function (colorize) {
    colorize.black = makeColorizeFunc('\x1b[30m');
    colorize.red = makeColorizeFunc('\x1b[31m');
    colorize.green = makeColorizeFunc('\x1b[32m');
    colorize.yellow = makeColorizeFunc('\x1b[33m');
    colorize.blue = makeColorizeFunc('\x1b[34m');
    colorize.magenta = makeColorizeFunc('\x1b[35m');
    colorize.cyan = makeColorizeFunc('\x1b[36m');
    colorize.white = makeColorizeFunc('\x1b[37m');
})(colorize = exports.colorize || (exports.colorize = {}));
class LoggerImpl {
    constructor() {
        this.indentValue = 0;
    }
    indent() {
        this.indentValue++;
    }
    reset() {
        this.indentValue = 0;
    }
    unindent() {
        this.indentValue--;
    }
    logTrace(trace, ...str) {
        this.logInternal(trace.verbose.bind(trace), ...str);
    }
    log(...str) {
        this.logInternal(console.log, ...str);
    }
    logInternal(logFunc, ...str) {
        let result = '';
        for (let i = 0; i < this.indentValue; i++) {
            result += '|   ';
        }
        logFunc(result + str.join(''));
    }
}
exports.LoggerImpl = LoggerImpl;
exports.logger = new LoggerImpl();

//# sourceMappingURL=coeditingUtils.js.map
