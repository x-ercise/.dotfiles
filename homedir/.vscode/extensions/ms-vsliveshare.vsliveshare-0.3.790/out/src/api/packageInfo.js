"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
function getPackageInfo(packagePath) {
    const packageJsonPath = path.join(packagePath, 'package.json');
    try {
        const packageInfo = require(packageJsonPath);
        // Ensure the name/version/publisher cannot be changed.
        // (Note this does not recursively freeze nested objects.)
        return Object.freeze({
            fullName: `${packageInfo.publisher || 'unknown'}.${packageInfo.name}`,
            name: packageInfo.name,
            version: packageInfo.version,
            publisher: packageInfo.publisher,
            contributes: packageInfo.contributes,
        });
    }
    catch (e) {
        return null;
    }
}
function getStackFrames() {
    // This code uses V8-specific stack-trace APIs, but
    // that should be fine because VS Code always uses V8.
    if (!Error.captureStackTrace)
        return null;
    const error = new Error();
    const defaultPrepareStackTrace = Error.prepareStackTrace;
    Error.prepareStackTrace = (o, s) => s;
    Error.captureStackTrace(error, getStackFrames);
    const stack = error.stack;
    Error.prepareStackTrace = defaultPrepareStackTrace;
    if (!Array.isArray(stack)) {
        // The stack is not present or is not an array.
        // The call to captureStackTrace() didn't work?
        return null;
    }
    const stackTrace = stack.map((callSite) => {
        const typeName = callSite.getTypeName();
        const methodName = callSite.getMethodName();
        const functionName = (typeName && methodName ?
            typeName + '.' + methodName : callSite.getFunctionName());
        return { functionName, fileName: callSite.getFileName() };
    });
    return stackTrace;
}
/**
 * Gets the identity of a package that called us.
 * @param functionName Function name (or class.method) to search for in
 * the current stack.
 * @returns Identity of the package that called the specified function,
 * or `null` if it could not be determined.
 */
function getCallingPackage(functionName) {
    const stackFrames = getStackFrames();
    if (!stackFrames)
        return null;
    // Find the stack frame that indicates the caller of the getApiAsync() method.
    const getApiFrameIndex = stackFrames.findIndex((f) => f.functionName === functionName);
    if (getApiFrameIndex >= 0 && getApiFrameIndex < stackFrames.length - 1) {
        const callerFrame = stackFrames[getApiFrameIndex + 1];
        // Load the package info for the stack frame.
        // Look for the package at the source root, or one level above (to support webpack).
        const packagePath = (callerFrame.fileName || '')
            .replace(/[\\\/][^\\\/]*$/, '') // Strip filename
            .replace(/[\\\/]node_modules[\\\/].*/, ''); // Strip module directory
        return getPackageInfo(packagePath) || getPackageInfo(path.dirname(packagePath));
    }
    return null;
}
exports.getCallingPackage = getCallingPackage;

//# sourceMappingURL=packageInfo.js.map
