"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const configCore = require("../../config");
/**
 * Helper function for working with config settings.
 */
class ConfigUtil {
    get(key) {
        return configCore.get(key);
    }
    save(key, value, global = true, delaySaveToDisk = false) {
        return configCore.save(key, value, global, delaySaveToDisk);
    }
}
exports.ConfigUtil = ConfigUtil;

//# sourceMappingURL=ConfigUtil.js.map
