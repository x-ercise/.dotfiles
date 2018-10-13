"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class UserError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
    }
}
exports.UserError = UserError;

//# sourceMappingURL=UserError.js.map
