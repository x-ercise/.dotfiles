"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Helper functions for working with the clipboard.
 */
class ContextUtil {
    scrubPrefix(value) {
        return value ? value.replace('liveshare.', '') : value;
    }
}
exports.ContextUtil = ContextUtil;

//# sourceMappingURL=ContextUtil.js.map
