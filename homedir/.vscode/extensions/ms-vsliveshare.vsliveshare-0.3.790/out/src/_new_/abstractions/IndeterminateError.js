"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class IndeterminateError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
    }
}
exports.IndeterminateError = IndeterminateError;

//# sourceMappingURL=IndeterminateError.js.map
