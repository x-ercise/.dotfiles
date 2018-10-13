"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("../../util");
class StringUtil {
    getString(key) {
        return util_1.ExtensionUtil.getString(key);
    }
    getErrorString(code) {
        return util_1.ExtensionUtil.getErrorString(code);
    }
    getProgressUpdateString(code) {
        return util_1.ExtensionUtil.getProgressUpdateString(code);
    }
}
exports.StringUtil = StringUtil;

//# sourceMappingURL=StringUtil.js.map
