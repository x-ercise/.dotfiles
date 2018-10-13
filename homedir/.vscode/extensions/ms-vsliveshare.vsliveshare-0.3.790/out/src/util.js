//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const os = require("os");
const getos = require("getos");
const path = require("path");
const fs = require("fs");
const fse = require("fs-extra");
const semver = require("semver");
const traceSource_1 = require("./tracing/traceSource");
const config = require("./config");
const outputTraceListener_1 = require("./tracing/outputTraceListener");
const logFileTraceListener_1 = require("./tracing/logFileTraceListener");
const VSLS_1 = require("./contracts/VSLS");
const read_last_lines_1 = require("read-last-lines");
const telemetry_1 = require("./telemetry/telemetry");
const telemetryStrings_1 = require("./telemetry/telemetryStrings");
const telemetryFilters_1 = require("./telemetry/telemetryFilters");
class CancellationError extends Error {
    constructor(message, code) {
        super(...arguments);
        this.code = code;
    }
}
exports.CancellationError = CancellationError;
const defaultProgressOptions = {
    location: vscode.ProgressLocation.Window,
    title: ''
};
const userProgressOptionsDefaults = Object.assign({}, defaultProgressOptions, { isUserInitiated: true, cancellationToken: null });
const pathMonikerPrefix = '~';
var OSPlatform;
(function (OSPlatform) {
    OSPlatform["MACOS"] = "darwin";
    OSPlatform["WINDOWS"] = "win32";
    OSPlatform["LINUX"] = "linux";
})(OSPlatform = exports.OSPlatform || (exports.OSPlatform = {}));
var OSArchitecture;
(function (OSArchitecture) {
    OSArchitecture["X64"] = "x64";
    OSArchitecture["X86"] = "X86";
})(OSArchitecture = exports.OSArchitecture || (exports.OSArchitecture = {}));
const minSupportedOSVersions = {
    MacOS: '16.0.0',
    Windows: '6.1.7601',
    Linux: undefined
};
function getSupportedRuntimeIdentifiers() {
    switch (os.platform()) {
        case 'win32': return ['win7-x86', 'win', 'win-x86'];
        case 'darwin': return ['osx.10.10-x64', 'osx', 'osx-x64', 'unix'];
        case 'linux': return ['linux-x64', 'unix'];
        default: return [];
    }
}
exports.getSupportedRuntimeIdentifiers = getSupportedRuntimeIdentifiers;
function getPipePath(pipeName) {
    if (process.platform === 'win32') {
        return `\\\\.\\pipe\\${pipeName}`;
    }
    else {
        // .NET Core on Mac/Linux uses this pattern for pipe paths. Reference:
        // https://github.com/dotnet/corefx/blob/master/src/System.IO.Pipes/src/System/IO/Pipes/PipeStream.Unix.cs
        return `${os.tmpdir()}/CoreFxPipe_${pipeName}`;
    }
}
exports.getPipePath = getPipePath;
/**
 * Performs a multiplication where the operation is constrained to 32 bits.
 */
function mul32(m, n) {
    const nlo = n & 0xffff;
    const nhi = n - nlo;
    return ((nhi * m | 0) + (nlo * m | 0)) | 0;
}
/**
 * Custom string hash function, ported from the VS extension.
 */
function calculateFileHash(source) {
    let hash1 = (5381 << 16) + 5381;
    let hash2 = hash1;
    let index = 0;
    const length = source.length;
    while (length >= index + 4) {
        let p0 = (source.charCodeAt(index + 1) << 16) + source.charCodeAt(index);
        let p1 = (source.charCodeAt(index + 3) << 16) + source.charCodeAt(index + 2);
        hash1 = ((hash1 << 5) + hash1 + (hash1 >> 27)) ^ p0;
        hash2 = ((hash2 << 5) + hash2 + (hash2 >> 27)) ^ p1;
        index += 4;
    }
    if (length > index) {
        let p0 = source.charCodeAt(index);
        if (length > index + 1) {
            p0 += source.charCodeAt(index + 1) << 16;
        }
        hash1 = ((hash1 << 5) + hash1 + (hash1 >> 27)) ^ p0;
    }
    if (length > index + 2) {
        let p1 = source.charCodeAt(index + 2);
        if (length > index + 3) {
            p1 += source.charCodeAt(index + 3) << 16;
        }
        hash2 = ((hash2 << 5) + hash2 + (hash2 >> 27)) ^ p1;
    }
    return (hash1 + mul32(hash2, 1566083941)) | 0; // '| 0' coerces the value to 32 bits.
}
exports.calculateFileHash = calculateFileHash;
var DebuggerAttached;
(function (DebuggerAttached) {
    DebuggerAttached[DebuggerAttached["Unknown"] = 0] = "Unknown";
    DebuggerAttached[DebuggerAttached["Yes"] = 1] = "Yes";
    DebuggerAttached[DebuggerAttached["No"] = 2] = "No";
})(DebuggerAttached || (DebuggerAttached = {}));
let isDebuggerAttached = DebuggerAttached.Unknown;
function checkDebugging() {
    if (isDebuggerAttached === DebuggerAttached.Unknown) {
        isDebuggerAttached = DebuggerAttached.No;
        for (let arg of process.execArgv) {
            if (arg.startsWith('--inspect-brk') || arg.startsWith('--debug')) {
                isDebuggerAttached = DebuggerAttached.Yes;
                break;
            }
        }
    }
    return (isDebuggerAttached === DebuggerAttached.Yes);
}
exports.checkDebugging = checkDebugging;
/**
 * Async function to get file or directory stats.
 *
 * @param fileOrDir File or directory path to get stats for.
 * @returns File or directory stats.
 */
exports.statAsync = (fileOrDir) => {
    return new Promise((resolve, reject) => {
        fse.stat(fileOrDir, (err, stats) => err ? reject(err) : resolve(stats));
    });
};
/**
 * Async function to get the immediate children of a directory.
 */
exports.readdirAsync = (dir) => {
    return new Promise((resolve, reject) => {
        fse.readdir(dir, (err, children) => err ? reject(err) : resolve(children));
    });
};
/**
 * Searches for files in a directory that pass a given filter.
 *
 * @param root Returned results are paths relative to this root.
 * @param dir Starting directory for the search.
 * @param filter Optional callback to filter the files.
 */
exports.findFilesAsync = async (root, dir, filter) => {
    let results = [];
    let children = [];
    try {
        children = await exports.readdirAsync(dir);
    }
    catch (e) {
        // Skip a directory if it couldn't be read.
    }
    for (let child of children) {
        const childPath = path.join(dir, child);
        let childStat;
        try {
            childStat = await exports.statAsync(childPath);
        }
        catch (e) {
            // Skip a child if it couldn't be read.
            continue;
        }
        if (childStat.isDirectory()) {
            const childResults = await exports.findFilesAsync(root, childPath, filter);
            results = results.concat(childResults);
        }
        else {
            const childRelativePath = path.relative(root, childPath);
            if (!filter || filter(childRelativePath)) {
                results.push(childRelativePath);
            }
        }
    }
    return results;
};
/**
 * Function to check whether value is a Date.
 *
 * @param date Value to check the type for.
 * @returns Whether the date is of type of date.
 */
exports.isDate = (date) => {
    return Object.prototype.toString.call(date) === '[object Date]';
};
/**
 * Function to get retrospective timestamp age in ms.
 *
 * @param timestamp Timestamp to check age for.
 * @returns Age in milliseconds.
 */
exports.getTimestampAge = (timestamp) => {
    const date = (exports.isDate(timestamp))
        ? timestamp
        : new Date(timestamp);
    return Date.now() - date.valueOf();
};
/**
 * Function to sleep for a certain amount of milliseconds without blocking main thread.
 *
 * @param delay Amount of milliseconds to sleep for.
 * @returns Promise that will be resolved after `delay` milliseconds.
 */
exports.sleepAsync = (delay) => {
    return new Promise((resolve) => {
        setTimeout(resolve, delay);
    });
};
/**
 * Async function to get file modification time.
 *
 * @param filePath File path to get modification time for.
 * @returns Date string when the file was modificated.
 */
exports.getModificationTime = async (filePath) => {
    const fileStats = await exports.statAsync(filePath);
    return fileStats.mtime;
};
function fileExistsAsync(filePath) {
    return new Promise((resolve) => {
        fs.stat(filePath, (err, stats) => {
            if (stats && stats.isFile()) {
                resolve(true);
            }
            else {
                resolve(false);
            }
        });
    });
}
exports.fileExistsAsync = fileExistsAsync;
/**
 * Function to open a file asynchronously.
 *
 * @param filePath File to open.
 * @param openMode Open mode string.
 * @returns Promise with `file descriptor` if fulfills.
 */
exports.openFileAsync = (filePath, openMode) => {
    return new Promise((resolve, reject) => {
        fs.open(filePath, openMode, (err, fileDescriptior) => {
            if (err) {
                reject(err);
            }
            resolve(fileDescriptior);
        });
    });
};
/**
 * Copies a file and then calls stat to check if the file was copied.
 * Throws if the file didn't get copied.
 */
function copyElseThrowSync(sourcePath, targetPath) {
    fse.copySync(sourcePath, targetPath);
    // Check to see if the file was copied - we've seen cases where it's not.
    fs.statSync(targetPath);
}
exports.copyElseThrowSync = copyElseThrowSync;
/**
 * Moves a file and then calls stat to check if the file was moved.
 * Throws if the file didn't get moved.
 */
function moveElseThrowSync(sourcePath, targetPath) {
    fs.renameSync(sourcePath, targetPath);
    // Check to see if the file was moved - we've seen cases where it's not
    // (will throw if not found) and then check that it has content.
    // Check that it has content
    const fileStats = fs.statSync(targetPath);
    if (fileStats.size <= 0) {
        throw new Error(`Setup of package files failed verification tests. Source: ${sourcePath}, target: ${targetPath}`);
    }
}
exports.moveElseThrowSync = moveElseThrowSync;
function getPlatformProperty() {
    switch (os.platform()) {
        case OSPlatform.WINDOWS:
            return 'windows';
        case OSPlatform.MACOS:
            return 'osx';
        case OSPlatform.LINUX:
        default:
            return 'linux';
    }
}
exports.getPlatformProperty = getPlatformProperty;
class ExtensionUtil {
    static async InitLogging() {
        this.outputTraceListener = new outputTraceListener_1.OutputTraceListener(config.get(config.Key.name));
        traceSource_1.traceSource.addTraceListener(this.outputTraceListener);
        this.setDiagnosticLogging();
        this.logFileTraceListener = new logFileTraceListener_1.LogFileTraceListener('VSCode');
        await this.logFileTraceListener.openAsync();
        ExtensionUtil.clientLogFilePath = this.logFileTraceListener.logFileName;
        traceSource_1.traceSource.info('Trace log: ' + this.logFileTraceListener.logFileName);
        traceSource_1.traceSource.addTraceListener(this.logFileTraceListener);
        traceSource_1.traceSource.info('Extension, IDE, OS : ' + ExtensionUtil.clientInfoToString(ExtensionUtil.getVersionInfo()));
        ExtensionUtil.handleUnhandledRejections();
    }
    static setLoggingFilters() {
        const filters = config.get(config.Key.traceFilters);
        this.outputTraceListener.filter = new traceSource_1.GlobPatternTraceFilter(filters);
        this.logFileTraceListener.filter = new traceSource_1.GlobPatternTraceFilter(filters);
    }
    static async setDiagnosticLogging(focus = false) {
        // Get diagnosticLogging value
        this.diagnosticLoggingValue = config.get(config.Key.diagnosticLogging);
        if (this.diagnosticLoggingValue) {
            this.outputTraceListener.addOutputChannel(focus);
        }
        else {
            this.outputTraceListener.removeOutputChannel();
        }
    }
    static getClientLogFilePath() {
        return ExtensionUtil.clientLogFilePath;
    }
    static async InitAsync(context) {
        ExtensionUtil.extensionContext = context;
        ExtensionUtil.strings = require('../../strings.nls.json');
        telemetry_1.Instance.addFilter(new telemetryFilters_1.SendOnceFilter(telemetryStrings_1.TelemetryEventNames.UNHANDLED_REJECTION_FAULT, [telemetryStrings_1.TelemetryPropertyNames.EVENT_MESSAGE]));
    }
    /**
     * Gets a string from `strings.nls.json`.
     */
    static getString(key) {
        let s = ExtensionUtil.strings[key];
        if (s) {
            s = s.replace('$(shortName)', config.get(config.Key.shortName));
        }
        return s;
    }
    /**
     * Gets an error string from `strings.nls.json`.
     */
    static getErrorString(code) {
        return ExtensionUtil.getString('error.' + (VSLS_1.ErrorCodes[code] || code));
    }
    static getProgressUpdateString(code) {
        return ExtensionUtil.getString('progress.' + code);
    }
    /**
     * Attempts to lookup a custom error message for the error code, if the error has a
     * code property and a custom message is available. Then shows that message, or the
     * fallback error message property.
     */
    static async showErrorAsync(error, options = {}, items = []) {
        const message = typeof error === 'string' ? error : ExtensionUtil.getErrorString(error.code) || error.message;
        const { title, error: customError = message, modal } = options;
        const reportAProblemItem = { title: 'Report a Problem' };
        const result = await vscode.window.showErrorMessage(message, { modal }, reportAProblemItem, ...items);
        if (result && result.title === reportAProblemItem.title) {
            const versionInfo = ExtensionUtil.getVersionInfo();
            const issueTitle = encodeURIComponent(`[VS Code] ${title || message}`);
            const issueBody = encodeURIComponent('<!-- %0AFor Visual Studio problems/feedback, please use the "Report a Problem..." feature built into the tool. See https://aka.ms/vsls-vsproblem.'
                + '%0A%0AFor VS Code issues, attach verbose logs as follows:'
                + '%0A1. Press F1 (or Ctrl-Shift-P), type "export logs" and run the "Live Share: Export Logs" command.'
                + '%0A2. Drag and drop the zip to the issue on this screen and wait for it to upload before creating the issue.'
                + '%0A%0AFor feature requests, please include enough of this same info so we know if the request is tool or language/platform specific.%0A-->'
                + `%0A%0A%23%23 Error:%0A${customError}`
                + `%0A%0A%23%23 Steps to Reproduce:%0A1.%0A2.`
                + '%0A%0A||Version Data|%0A|-:|:-|%0A'
                + Object.keys(versionInfo)
                    .map(key => `|**${key}**|${versionInfo[key]}|`)
                    .join('%0A'));
            ExtensionUtil.openBrowser(`${config.get(config.Key.gitHubUri)}/issues/new?title=${issueTitle}&body=${issueBody}`);
        }
        return result;
    }
    static get Context() {
        return ExtensionUtil.extensionContext;
    }
    static handleUnhandledRejections() {
        const srcDir = path.resolve(__dirname, '..');
        process.on('unhandledRejection', (e, p) => {
            if (!(e.stack && e.stack.indexOf(srcDir) > 0)) {
                // Ignore unhandled rejections from other extensions that share the process.
                return;
            }
            const message = 'Unhandled promise rejection: ';
            traceSource_1.traceSource.error(message + e.stack);
            telemetry_1.Instance.sendFault(telemetryStrings_1.TelemetryEventNames.UNHANDLED_REJECTION_FAULT, telemetry_1.FaultType.Error, message + e.message, e);
            // Prevent the unhandled rejection from being reported in the debug console by VS Code.
            p.catch(() => { });
        });
    }
    static registerCommand(command, callback, thisArg) {
        return vscode.commands.registerCommand(command, async function (...args) {
            try {
                new telemetry_1.TelemetryEvent(telemetryStrings_1.TelemetryEventNames.COMMAND_INITIATED)
                    .addProperty('commandName', command)
                    .send();
                return await callback.call(this, ...args);
            }
            catch (e) {
                ExtensionUtil.reportCommandError(command, e);
            }
        }, thisArg);
    }
    static registerTextEditorCommand(command, callback, thisArg) {
        return vscode.commands.registerTextEditorCommand(command, function (textEditor, edit, ...args) {
            try {
                return callback.call(this, textEditor, edit, ...args);
            }
            catch (e) {
                ExtensionUtil.reportCommandError(command, e);
            }
        }, thisArg);
    }
    static reportCommandError(command, e) {
        const message = `Unhandled error in '${command}' command: `;
        traceSource_1.traceSource.error(message + (e.stack || e.message || e));
        telemetry_1.Instance.sendFault(telemetryStrings_1.TelemetryEventNames.UNHANDLED_COMMAND_ERROR_FAULT, telemetry_1.FaultType.Error, message + (e.message || e), e);
        ExtensionUtil.showErrorAsync(e);
    }
    static async tryRegisterCommand(command, callback, thisArg, isEditorCommand = false, force = false) {
        let isDefined = await ExtensionUtil.isCommandDefined(command);
        let disposable;
        if (isDefined) {
            disposable = this.registeredCommands[command];
            if (!force) {
                return disposable;
            }
            if (disposable) {
                const index = ExtensionUtil.Context.subscriptions.indexOf(disposable);
                if (index >= 0) {
                    ExtensionUtil.Context.subscriptions.splice(index, 1);
                }
                disposable.dispose();
            }
        }
        try {
            if (isEditorCommand) {
                disposable = ExtensionUtil.registerTextEditorCommand(command, callback, thisArg);
            }
            else {
                disposable = ExtensionUtil.registerCommand(command, callback, thisArg);
            }
            ExtensionUtil.registeredCommands[command] = disposable;
            ExtensionUtil.Context.subscriptions.push(disposable);
        }
        catch (e) {
            console.error(e);
        }
        return disposable;
    }
    static async isCommandDefined(command) {
        let commands = await vscode.commands.getCommands();
        return commands.indexOf(command) >= 0;
    }
    static disposeCommand(command) {
        if (this.registeredCommands[command]) {
            this.registeredCommands[command].dispose();
            delete this.registeredCommands[command];
        }
    }
    static writeFile(filePath, content) {
        return new Promise((resolve, reject) => {
            fs.writeFile(filePath, content, (error) => {
                error ? reject(error) : resolve();
            });
        });
    }
    static readLastNLinesFromFile(filePath, numLines) {
        return filePath ? read_last_lines_1.read(filePath, numLines) : Promise.resolve('');
    }
    //If ```progressText``` is the empty string, then no spinner is shown, hence the space
    static async runWithProgress(fn, progressOptions = userProgressOptionsDefaults) {
        const options = Object.assign({}, userProgressOptionsDefaults, progressOptions);
        const { isUserInitiated, cancellationToken } = options;
        if (cancellationToken && cancellationToken.isCancellationRequested) {
            return;
        }
        if (!isUserInitiated) {
            // If the ```title``` is the empty string, then no notification is shown
            options.title = '';
        }
        return await vscode.window.withProgress(options, async (progress) => {
            return new Promise(async (resolve, reject) => {
                if (cancellationToken) {
                    cancellationToken.onCancellationRequested(() => {
                        resolve();
                    });
                }
                try {
                    resolve(await fn(progress));
                }
                catch (e) {
                    reject(e);
                }
            });
        });
    }
    /**
     * Registers files to be deleted on extension unload.
     *
     * @param filePaths The paths to delete.
     */
    static disposeOnUnload(filePaths) {
        this.extensionContext.subscriptions.push({
            dispose() {
                try {
                    for (let filePath of filePaths) {
                        fs.unlinkSync(filePath);
                    }
                }
                catch (e) {
                    /* ignore dispose exceptions */
                    console.log('Could not properly dispose files. ' + e.message);
                }
            }
        });
    }
    static getExtensionVersion() {
        const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
        const { version } = require(packageJsonPath);
        return version;
    }
    static getProtocolVersion() {
        const versionJsonPath = path.join(__dirname, '..', '..', 'version.json');
        const { protocolVersion } = require(versionJsonPath);
        return protocolVersion;
    }
    static async updateExecutablePermissionsAsync() {
        const extensionRootPath = path.join(__dirname, '..', '..');
        const packageJsonPath = path.join(extensionRootPath, 'package.json');
        const { executables } = require(packageJsonPath);
        const platformExecutables = {
            [OSPlatform.LINUX]: executables.linux,
            [OSPlatform.MACOS]: executables.osx,
            [OSPlatform.WINDOWS]: []
        }[os.platform()];
        try {
            for (let currentPath of platformExecutables) {
                const fullPath = path.join(extensionRootPath, currentPath);
                let currentMode;
                try {
                    currentMode = await ExtensionUtil.getFileModeAsync(fullPath);
                }
                catch (e) {
                    // Ignore missing executable files at this point. They will
                    // likely cause errors later, but those errors will be better.
                    traceSource_1.traceSource.error(`Could not get file mode of ${fullPath}: ${e.message}`);
                    if (e.code === 'ENOENT')
                        continue;
                    throw e;
                }
                const newMode = ExtensionUtil.getOwnerExeMode(currentMode);
                if (currentMode !== newMode) {
                    await ExtensionUtil.chExeModeAsync(fullPath, newMode);
                }
            }
        }
        catch (e) {
            vscode.window.showErrorMessage('Could not update the extension binaries execution permissions.');
        }
    }
    /**
     * Given a file, this method changes the owner permissions to rwx (7 octal).
     * The rest of the permissions (group, everyone else) are unchanged.
     *
     * @param fullPath Full path to the file.
     */
    static getOwnerExeMode(currentMode) {
        // make the first mode digit 7, leave the others the same
        // ex: 100655 -> 100755 octal
        return currentMode | parseInt('700', 8);
    }
    static chExeModeAsync(fullPath, mode) {
        return new Promise((resolve, reject) => {
            fs.chmod(fullPath, mode, (error) => {
                error ? reject(error) : resolve();
            });
        });
    }
    static getFileModeAsync(fullpath) {
        return new Promise((resolve, reject) => {
            fs.stat(fullpath, (error, stats) => {
                error ? reject(error) : resolve(stats.mode);
            });
        });
    }
    static getPlatformName() {
        switch (os.platform()) {
            case OSPlatform.WINDOWS: return 'Windows';
            case OSPlatform.MACOS: return 'MacOS';
            case OSPlatform.LINUX: return 'Linux';
            default: return os.platform();
        }
    }
    static getVersionInfo() {
        return {
            extensionName: config.get(config.Key.abbreviation),
            extensionVersion: ExtensionUtil.getExtensionVersion(),
            protocolVersion: ExtensionUtil.getProtocolVersion(),
            applicationName: 'VSCode',
            applicationVersion: vscode.version,
            platformName: ExtensionUtil.getPlatformName(),
            platformVersion: os.release(),
        };
    }
    static async checkCompatibility() {
        const platformName = ExtensionUtil.getPlatformName();
        const versionInfo = ExtensionUtil.getVersionInfo();
        switch (platformName) {
            case 'Windows':
                if (!semver.gte(versionInfo.platformVersion, minSupportedOSVersions.Windows)) {
                    throw new Error(this.reportVersionFailure('Windows', versionInfo));
                }
                break;
            case 'Linux':
                await new Promise((resolve, reject) => {
                    getos((error, linuxOs) => {
                        if (error) {
                            reject(error);
                        }
                        const linuxVersionInfo = {
                            dist: linuxOs.dist,
                            codename: linuxOs.codename,
                            release: linuxOs.release
                        };
                        telemetry_1.TelemetryEvent.create(telemetryStrings_1.TelemetryEventNames.LINUX_VERSION, {
                            properties: linuxVersionInfo
                        }).send();
                        // No strict version checking for Linux
                        resolve();
                    });
                });
                break;
            case 'MacOS':
                if (!semver.gte(versionInfo.platformVersion, minSupportedOSVersions.MacOS)) {
                    throw new Error(this.reportVersionFailure('MacOS', versionInfo));
                }
                break;
            default:
                break;
        }
        traceSource_1.traceSource.info(`Passed version check for ${platformName}: found ${versionInfo.platformVersion}`);
    }
    static reportVersionFailure(platformName, versionInfo) {
        traceSource_1.traceSource.error(`Failed ${platformName} version check: found ${versionInfo.platformVersion}`);
        telemetry_1.Instance.versionCheckFail(platformName, versionInfo.platformVersion);
        let version = versionInfo.platformVersion;
        if (platformName === 'MacOS') {
            // mapping from https://en.wikipedia.org/wiki/Uname
            // kernel version is ahead of sub version by 4. E.g. 10.11 is kernel 15.x.x
            let kernelMajor = parseInt(version.split('.')[0], 10);
            version = '10.' + (kernelMajor - 4);
        }
        return `Your version of ${platformName} (${version}) is not compatible with this version of ${config.get(config.Key.name)}.`;
    }
    static checkAgentVersion(agentInfo) {
        const myVersion = ExtensionUtil.getExtensionVersion();
        const agentVersion = agentInfo && agentInfo.version;
        let myProtocolVersion = ExtensionUtil.getProtocolVersion();
        let agentProtocolVersion = agentInfo && agentInfo.protocolVersion;
        traceSource_1.traceSource.info(`Client version: ${myVersion} (VSLS/${myProtocolVersion}), ` +
            `agent version: ${agentVersion} (VSLS/${agentProtocolVersion})`);
        if (myProtocolVersion && agentProtocolVersion) {
            // Semver requires 3-part versions. Protocol versions are currently two-part.
            if (myProtocolVersion.split('.').length < 3)
                myProtocolVersion += '.0';
            if (agentProtocolVersion.split('.').length < 3)
                agentProtocolVersion += '.0';
            // These errors should only be encountered in internal development,
            // because released extension builds bundle the same-version agent.
            if (semver.lt(myProtocolVersion, agentProtocolVersion)) {
                throw new Error(ExtensionUtil.getErrorString(VSLS_1.ErrorCodes.OlderThanAgent));
            }
            else if (semver.gt(myProtocolVersion, agentProtocolVersion)) {
                throw new Error(ExtensionUtil.getErrorString(VSLS_1.ErrorCodes.NewerThanAgent));
            }
        }
    }
    static clientInfoToString(clientInfo) {
        let s = '';
        if (!clientInfo) {
            return s;
        }
        if (clientInfo.extensionVersion) {
            if (clientInfo.extensionName) {
                s += clientInfo.extensionName;
                s += '/';
            }
            s += clientInfo.extensionVersion;
        }
        if (clientInfo.applicationVersion) {
            if (s.length > 0) {
                s += ' ';
            }
            if (clientInfo.applicationName) {
                s += clientInfo.applicationName;
                s += '/';
            }
            s += clientInfo.applicationVersion;
        }
        if (clientInfo.platformVersion) {
            if (s.length > 0) {
                s += ' ';
            }
            if (clientInfo.platformName) {
                s += clientInfo.platformName;
                s += '/';
            }
            s += clientInfo.platformVersion;
        }
        return s;
    }
    static agentInfoToString(agentInfo) {
        return agentInfo ? 'VSLSAgent/' + agentInfo.version : '';
    }
    static async setCommandContext(key, value) {
        await vscode.commands.executeCommand('setContext', key, value);
    }
    static async promptLinuxDependencyInstall(message) {
        let done = false;
        while (!done) {
            const response = await vscode.window.showErrorMessage(message + ' You may be missing key Linux libraries. Install them now?', 'More Info', 'Install', 'Cancel');
            switch (response) {
                case 'More Info':
                    ExtensionUtil.openBrowser('https://aka.ms/vsls-docs/linux-prerequisites');
                    break;
                case 'Install':
                    let terminal = vscode.window.createTerminal('Linux dependency installer');
                    terminal.sendText('clear && bash "' + path.join(__dirname, '..', 'deps', 'linux-prereqs.sh') + '" && exit 0', true);
                    terminal.show(false);
                    done = true;
                    break;
                default:
                    done = true;
                    break;
            }
        }
    }
    static openBrowser(uri) {
        if (process.env.VSLS_TEST_DISABLE_BROWSE) {
            // UI tests need to set up browser windows for automation, so they can't support
            // the browser getting launched directly.
            vscode.window.showInformationMessage('[OPEN] ' + uri);
        }
        else {
            vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(uri));
        }
    }
    /**
     * Gets a flag indicating whether modal notifications should be enabled.
     * (Modal dialogs block automated UI tests; non-modal notifications are automatiable.)
     */
    static get enableModalNotifications() {
        return !process.env.VSLS_TEST_DISABLE_MODAL;
    }
    /**
     * Work around an issue in the UI automation driver that can
     * randomly hang if a reload is triggered immediately by automation.
     */
    static async delayIfAutomating() {
        if (process.env.VSLS_TEST_DELAY_RELOAD) {
            await new Promise((c) => setTimeout(c, 1000));
        }
    }
}
ExtensionUtil.registeredCommands = {};
exports.ExtensionUtil = ExtensionUtil;
class PathUtil {
    /**
     * Given a scheme qualified path like vsls://blah, replace the scheme with the provided replacement.
     */
    static replaceSchemeWithPath(filePath, replacementPath) {
        if (replacementPath.endsWith('/') || replacementPath.endsWith('\\')) {
            replacementPath = replacementPath.substr(0, replacementPath.length - 1);
        }
        return filePath.replace(PathUtil.schemeQualifierRegExp, replacementPath);
    }
    static getMonikerFromUri(uri) {
        if (uri.scheme !== config.get(config.Key.scheme)) {
            return null;
        }
        return PathUtil.getMonikerFromRelativePath(uri.path);
    }
    static getMonikerFromRelativePath(rawPath) {
        const indexOfSecondSlash = rawPath.indexOf('/', 1);
        if (indexOfSecondSlash < 3 || rawPath[1] !== pathMonikerPrefix) {
            return {
                moniker: '',
                relativePath: rawPath,
            };
        }
        const monikerLength = ((indexOfSecondSlash > 1) ? indexOfSecondSlash : rawPath.length) - 2;
        const rootMoniker = rawPath.substr(2, monikerLength);
        const relativePath = rawPath.substr(2 + monikerLength);
        return {
            moniker: rootMoniker,
            relativePath: relativePath
        };
    }
    static getRelativePathFromPrefixedPath(prefxiedPath) {
        const { moniker, relativePath } = PathUtil.getMonikerFromRelativePath(prefxiedPath);
        if (moniker !== '0') {
            return prefxiedPath;
        }
        return relativePath;
    }
    static getPrefixedRoot(moniker) {
        if (moniker === '0' || !moniker) {
            return '/';
        }
        return `/${pathMonikerPrefix}${moniker}`;
    }
    /**
     * Given a line of text with some scheme qualified paths like vsls:\\blah, replace the scheme with the provided replacement.
     */
    static replaceSchemeWithPathInLine(line, replacementPath) {
        // Make sure to forward slashes in paths if the owner is on a Mac.
        let normalizedLine = line.replace(PathUtil.schemeQualifiedPathRegExp, (match) => PathUtil.convertToForwardSlashesIfNeeded(match, replacementPath));
        return PathUtil.replaceSchemeWithPath(normalizedLine, replacementPath);
    }
    static replacePathWithScheme(filePath, rootPath) {
        // Chop off a trailing slash.
        if (rootPath.endsWith('/') || rootPath.endsWith('\\')) {
            rootPath = rootPath.substr(0, rootPath.length - 1);
        }
        let ownerRootPathIgnoringSlashesRegExp = new RegExp(rootPath.replace(/[\/\\]+/g, '[\\\/\\\\]+'), 'gi');
        return filePath.replace(ownerRootPathIgnoringSlashesRegExp, config.get(config.Key.scheme) + ':');
    }
    /**
     * Given a path and a root, replace the root with the vsls schema.
     */
    static replacePathWithSchemeInLine(line, rootPath) {
        let lineWithScheme = PathUtil.replacePathWithScheme(line, rootPath);
        // Normalize the rest of the scheme qualified path to have forward slashes.
        return lineWithScheme.replace(PathUtil.schemeQualifiedPathRegExp, (match) => match.replace(/[\/\\]+/g, '/'));
    }
    static removeRootFromFileSystemPath(filePath, rootPath) {
        // Chop off a trailing slash.
        if (rootPath.endsWith('/') || rootPath.endsWith('\\')) {
            rootPath = rootPath.substr(0, rootPath.length - 1);
        }
        let ownerRootPathIgnoringSlashesRegExp = new RegExp(rootPath.replace(/[\/\\]+/g, '[\\\/\\\\]+'), 'gi');
        return filePath.replace(ownerRootPathIgnoringSlashesRegExp, '');
    }
    static convertToForwardSlashes(filePath) {
        return filePath.replace(/\\\\/g, '/').replace(/\\/g, '/');
    }
    /**
     * Convert to forwardslashes, if the given rootPath is a mac-style path
     */
    static convertToForwardSlashesIfNeeded(filePath, rootPath) {
        if (rootPath[0] === '/') {
            return PathUtil.convertToForwardSlashes(filePath);
        }
        return filePath;
    }
    /**
     * Escape backslashes so that the path can be dropped inside a string inside a json blob.
     */
    static EscapeBackslash(filePath) {
        return filePath.replace(/\\/g, '\\\\');
    }
    /**
     * Path names are PII, so we need to remove all parts preceeding the filename.
     * Makes sure we don't accidentally scrub dates as well.
     */
    static removePath(filePath, replacementString = '') {
        return filePath.replace(/([A-Za-z]:)?(\S*[\\\/])+\S*/gi, (match, drive, directory, offset, whole) => {
            if (/^\d{1,4}\/\d{1,2}\/\d{1,4}$/.test(match)) { // This is a date. No need to scrub.
                return match;
            }
            else {
                const driveAndDirectoryLength = (drive ? drive.length : 0) + directory.length;
                const fileName = match.substr(driveAndDirectoryLength);
                return replacementString + fileName;
            }
        });
    }
    /**
     * Given the root path of a drive (i.e. '/' on mac or 'C:\' on windows),
     * replace all the path separators with dollar.
     *
     * 'C:' -> 'C$'
     * '/'  -> '$'
     */
    static getWorkspaceName(rootPath) {
        const name = path.basename(rootPath) || rootPath;
        // TODO: refactor regex to use /[\\\/]/g
        return name.replace(/:[\\|\/]?|\\|\//g, '$');
    }
    /**
     * Obtains the file system path from the primary (e.g. 0-indexed) workspace
     *
     * If no workspace is present, returns undefined.
     */
    static getPrimaryWorkspaceFileSystemPath() {
        if (!vscode.workspace.workspaceFolders
            || !vscode.workspace.workspaceFolders.length) {
            return undefined;
        }
        return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
}
PathUtil.schemeQualifierRegExp = new RegExp(config.get(config.Key.scheme) + ':', 'g');
PathUtil.schemeQualifiedPathRegExp = new RegExp('\"' + config.get(config.Key.scheme) + ':([^"]*)\"', 'g');
PathUtil.remoteSchemeUri = vscode.Uri.parse(`${config.get(config.Key.scheme)}:/`);
exports.PathUtil = PathUtil;
var PromiseStatus;
(function (PromiseStatus) {
    PromiseStatus[PromiseStatus["Pending"] = 0] = "Pending";
    PromiseStatus[PromiseStatus["Fulfilled"] = 1] = "Fulfilled";
    PromiseStatus[PromiseStatus["Rejected"] = 2] = "Rejected";
    PromiseStatus[PromiseStatus["NotAPromise"] = 3] = "NotAPromise";
})(PromiseStatus = exports.PromiseStatus || (exports.PromiseStatus = {}));
/**
 * Util to get promise status.
 * @param p Promise to check the status on.
 */
exports.getPromiseState = async (p) => {
    if (!p) {
        return PromiseStatus.NotAPromise;
    }
    const t = {};
    return await Promise.race([p, t]).then((v) => {
        return (v === t)
            ? PromiseStatus.Pending
            : PromiseStatus.Fulfilled;
    }, () => PromiseStatus.Rejected);
};
/**
 * Check if the cancellation token source is still active.
 * @param source Cancellation token source to check.
 */
exports.isActiveCancellationTokenSource = (source) => {
    return !!(source && !source.token.isCancellationRequested);
};
class Signal {
    constructor() {
        this.promiseToComplete = new Promise((resolve, reject) => {
            this.promiseResolve = resolve;
            this.promiseReject = reject;
        });
    }
    complete(result) {
        this.promiseResolve(result);
    }
    completeVoid() {
        this.promiseResolve(undefined);
    }
    reject(error) {
        this.promiseReject(error);
    }
    cancel() {
        this.promiseReject(new CancellationError());
    }
    get promise() {
        return this.promiseToComplete;
    }
}
exports.Signal = Signal;

//# sourceMappingURL=util.js.map
