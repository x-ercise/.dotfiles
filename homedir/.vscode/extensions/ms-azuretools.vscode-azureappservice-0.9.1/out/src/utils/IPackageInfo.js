"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function getPackageInfo(context) {
    // tslint:disable-next-line:non-literal-require
    const extensionPackage = require(context.asAbsolutePath('./package.json')); // context.asAbsolutePath here is trusted
    if (extensionPackage) {
        return {
            name: extensionPackage.name,
            version: extensionPackage.version,
            aiKey: extensionPackage.aiKey
        };
    }
    return undefined;
}
exports.getPackageInfo = getPackageInfo;
//# sourceMappingURL=IPackageInfo.js.map