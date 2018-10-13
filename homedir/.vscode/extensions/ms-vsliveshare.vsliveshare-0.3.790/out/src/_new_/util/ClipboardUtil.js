"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const clipboardy_1 = require("clipboardy");
/**
 * Helper functions for working with the clipboard.
 */
class ClipboardUtil {
    pasteFromClipboard() {
        return clipboardy_1.readSync();
    }
    copyToClipboardAsync(value) {
        return clipboardy_1.write(value);
    }
}
exports.ClipboardUtil = ClipboardUtil;

//# sourceMappingURL=ClipboardUtil.js.map
