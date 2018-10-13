"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class NonBlockingError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
    }
}
exports.NonBlockingError = NonBlockingError;

//# sourceMappingURL=NonBlockingError.js.map
