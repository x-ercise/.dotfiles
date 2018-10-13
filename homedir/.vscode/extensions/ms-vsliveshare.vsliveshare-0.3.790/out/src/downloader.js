"use strict";
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const traceSource_1 = require("./tracing/traceSource");
const util = require("./util");
const packageManager_1 = require("./packageManager");
const path = require("path");
const fs = require("fs-extra");
const os = require("os");
const telemetry_1 = require("./telemetry/telemetry");
const glob = require("glob");
const acquisitionTelemetry_1 = require("./telemetry/acquisitionTelemetry");
const lockFile = require("lockfile");
const createHash_1 = require("./utils/createHash");
const getInstallFilePath = () => path.resolve(util.ExtensionUtil.Context.extensionPath, 'install.Lock');
const getLockFilePath = () => path.resolve(util.ExtensionUtil.Context.extensionPath, 'externalDeps.Lock');
/**
 * Polls a predicate function until it either resolves `true`, or the max number of attempts is reached (resolves `false`).
 *
 * @param predicate A function that returns `true` if polling should complete
 * @param interval Polling interval (ms)
 * @param maxAttempts How many polling attempts should occur before giving up
 */
async function poll(predicate, interval = 1000, maxAttempts = 1000) {
    return new Promise((resolve, reject) => {
        let count = 0;
        const intervalId = setInterval(() => {
            if (count > maxAttempts) {
                resolve(false);
            }
            const result = predicate();
            if (result) {
                clearInterval(intervalId);
                resolve(true);
            }
            count++;
        }, interval);
    });
}
var EnsureRuntimeDependenciesResult;
(function (EnsureRuntimeDependenciesResult) {
    EnsureRuntimeDependenciesResult[EnsureRuntimeDependenciesResult["Success"] = 0] = "Success";
    EnsureRuntimeDependenciesResult[EnsureRuntimeDependenciesResult["Failure"] = 1] = "Failure";
    EnsureRuntimeDependenciesResult[EnsureRuntimeDependenciesResult["AlreadyInstalled"] = 2] = "AlreadyInstalled";
})(EnsureRuntimeDependenciesResult = exports.EnsureRuntimeDependenciesResult || (exports.EnsureRuntimeDependenciesResult = {}));
/**
 * Class used to download the runtime dependencies
 */
class ExternalDownloader {
    constructor(packageJSON) {
        this.packageJSON = packageJSON;
    }
    static async ensureRuntimeDependenciesAsync(extension) {
        if (!await installFileExistsAsync()) {
            const downloader = new ExternalDownloader(extension.packageJSON);
            return await util.ExtensionUtil.runWithProgress((progress) => { return downloader.installRuntimeDependenciesAsync(progress); }, { title: 'Downloading dependencies...' });
        }
        else {
            return EnsureRuntimeDependenciesResult.AlreadyInstalled;
        }
    }
    async installRuntimeDependenciesAsync(progress) {
        const status = {
            setMessage: (text) => {
                progress.report({ message: text });
            }
        };
        const lockOptions = {
            // Consider the lockfile stale if it was created before the last boot.
            stale: os.uptime() * 1000,
        };
        if (lockFile.checkSync(getLockFilePath(), lockOptions)) {
            traceSource_1.traceSource.info('Dependencies already installed or being installed.');
            status.setMessage('Finishing VS Live Share installation...');
            const success = await poll(() => !lockFile.checkSync(getLockFilePath()));
            return (success)
                ? EnsureRuntimeDependenciesResult.Success
                : EnsureRuntimeDependenciesResult.Failure;
        }
        else {
            try {
                lockFile.lockSync(getLockFilePath(), lockOptions);
            }
            catch (e) {
                const lockFileFaultEvent = new telemetry_1.Fault(acquisitionTelemetry_1.AcquisitionTelemetryEventNames.LOCK_FILE_FAULT, telemetry_1.FaultType.Error, 'Failed to lock lock file.', e);
                lockFileFaultEvent.addProperty(acquisitionTelemetry_1.AcquisitionTelemetryPropertyNames.ERROR_CODE, e.code);
                lockFileFaultEvent.send();
                lockFile.unlockSync(getLockFilePath());
                lockFile.lockSync(getLockFilePath(), lockOptions);
            }
            traceSource_1.traceSource.info('Installing dependencies for Live Share...');
            let packageManager;
            let installationStage;
            let errorMessage = '';
            let result = EnsureRuntimeDependenciesResult.Failure;
            let telemetryEvent = telemetry_1.Instance.startTimedEvent(acquisitionTelemetry_1.AcquisitionTelemetryEventNames.ACQUIRE_DEPS, true);
            let platform;
            let architecture;
            try {
                installationStage = 'getPlatformInfo';
                platform = os.platform();
                architecture = os.arch();
                packageManager = new packageManager_1.PackageManager(platform, architecture, this.packageJSON);
                installationStage = 'downloadPackages';
                const workspaceConfig = vscode.workspace.getConfiguration();
                await packageManager.downloadPackagesAsync(status);
                installationStage = 'installPackages';
                await packageManager.installPackagesAsync(status);
                installationStage = 'installRuntimeExes';
                ExternalDownloader.installRuntimeSpecificAssets((sourcePath, targetPath) => {
                    util.copyElseThrowSync(sourcePath, targetPath);
                });
                installationStage = 'touchLockFile';
                await touchInstallFileAsync();
                installationStage = 'completeSuccess';
                result = EnsureRuntimeDependenciesResult.Success;
            }
            catch (error) {
                if (error instanceof packageManager_1.PackageError) {
                    // we can log the message in a PackageError to telemetry as we do not put PII in PackageError messages
                    if (error.innerError) {
                        errorMessage = 'Dependency download failed. ' + error.innerError.toString();
                    }
                    else {
                        errorMessage = 'Dependency download failed. ' + error.message;
                    }
                    if (error.pkg) {
                        telemetryEvent.addProperty(acquisitionTelemetry_1.AcquisitionTelemetryPropertyNames.PACKAGE_URL, error.pkg.url);
                        telemetryEvent.addProperty(acquisitionTelemetry_1.AcquisitionTelemetryPropertyNames.PACKAGE_CODE, error.pkg.code);
                    }
                }
                else {
                    // do not log raw errorMessage in telemetry as it is likely to contain PII.
                    errorMessage = 'Dependency download failed. ' + error.toString();
                }
                telemetry_1.Instance.sendFault(acquisitionTelemetry_1.AcquisitionTelemetryEventNames.ACQUIRE_DEPS_FAULT, telemetry_1.FaultType.Unknown, errorMessage);
                traceSource_1.traceSource.error(`Failed at stage: ${installationStage} - ${errorMessage}`);
            }
            finally {
                this.sendDownloadTelemetry(telemetryEvent, installationStage, platform, architecture, (result === EnsureRuntimeDependenciesResult.Success), errorMessage);
                this.sendPackageTelemetry(packageManager);
                status.setMessage('');
                lockFile.unlockSync(getLockFilePath());
            }
            return result;
        }
    }
    static installRuntimeSpecificAssets(copyFn) {
        const dotnetDir = path.join(util.ExtensionUtil.Context.extensionPath, 'dotnet_modules');
        const runtimesDir = path.join(dotnetDir, 'runtimes');
        const supportedRIDs = util.getSupportedRuntimeIdentifiers();
        supportedRIDs.forEach(rid => {
            const ridDir = path.join(runtimesDir, rid);
            const ridDirFiles = glob.sync('**/*', { cwd: ridDir, nodir: true, absolute: true });
            ridDirFiles.forEach(f => {
                const targetPath = path.join(dotnetDir, path.basename(f));
                copyFn(f, targetPath);
            });
        });
    }
    sendDownloadTelemetry(event, stage, platform, arch, success, errorMessage) {
        event.addProperty(acquisitionTelemetry_1.AcquisitionTelemetryPropertyNames.INSTALLATION_STAGE, stage);
        event.addProperty(acquisitionTelemetry_1.AcquisitionTelemetryPropertyNames.INSTALLATION_PLATFORM, platform);
        event.addProperty(acquisitionTelemetry_1.AcquisitionTelemetryPropertyNames.INSTALLATION_ARCH, arch);
        let message = success === true ? 'Dependency download success. ' : errorMessage;
        event.end(success === true ? telemetry_1.TelemetryResult.Success : telemetry_1.TelemetryResult.IndeterminateFailure, message);
    }
    sendPackageTelemetry(packageManager) {
        for (let key in packageManager.stats) {
            if (packageManager.stats.hasOwnProperty(key)) {
                const stats = packageManager.stats[key];
                const payload = {};
                this.addPropertyIfExists(payload, acquisitionTelemetry_1.AcquisitionTelemetryPropertyNames.DID_DOWNLOAD, stats.didDownload);
                this.addPropertyIfExists(payload, acquisitionTelemetry_1.AcquisitionTelemetryPropertyNames.CHECKSUM_PASS, stats.checksumPass);
                this.addPropertyIfExists(payload, acquisitionTelemetry_1.AcquisitionTelemetryPropertyNames.VSCODE_DOWNLOAD, stats.vscodeDownload);
                this.addPropertyIfExists(payload, acquisitionTelemetry_1.AcquisitionTelemetryPropertyNames.TOTAL_BASE_FILES_PRE_UNPACK, stats.totalBaseFilesPreUnpack);
                this.addPropertyIfExists(payload, acquisitionTelemetry_1.AcquisitionTelemetryPropertyNames.TOTAL_BASE_FILES_POST_UNPACK, stats.totalBaseFilesPostUnpack);
                this.addPropertyIfExists(payload, acquisitionTelemetry_1.AcquisitionTelemetryPropertyNames.TOTAL_BASE_FILES_PRE_MOVE, stats.totalBaseFilesPreMove);
                this.addPropertyIfExists(payload, acquisitionTelemetry_1.AcquisitionTelemetryPropertyNames.TOTAL_BASE_FILES_POST_MOVE, stats.totalBaseFilesPostMove);
                this.addPropertyIfExists(payload, acquisitionTelemetry_1.AcquisitionTelemetryPropertyNames.TOTAL_FILES_EXTRACTED, stats.totalFilesExtracted);
                this.addPropertyIfExists(payload, acquisitionTelemetry_1.AcquisitionTelemetryPropertyNames.TOTAL_FILES_MOVED_OFFSET, stats.totalFileMovedOffset);
                telemetry_1.Instance.sendTelemetryEvent(acquisitionTelemetry_1.AcquisitionTelemetryEventNames.ACQUIRE_DEPS_PACKAGE, payload);
            }
        }
    }
    addPropertyIfExists(properties, propertyName, value) {
        if (value !== undefined) {
            properties[propertyName] = value.toString();
        }
    }
}
exports.ExternalDownloader = ExternalDownloader;
function installFileExistsAsync() {
    return util.fileExistsAsync(getInstallFilePath());
}
exports.installFileExistsAsync = installFileExistsAsync;
function touchInstallFileAsync() {
    return new Promise((resolve, reject) => {
        fs.writeFile(getInstallFilePath(), '', err => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}
async function isInstallCorrupt(traceSource, manifest) {
    if (!manifest) {
        manifest = await getCompleteManifest();
    }
    const fileList = Object.keys(manifest);
    const hashTable = {};
    const ignoreFiles = ['verson.json', 'internalSettings.json', 'package.json', 'manifest.json', 'externalManifest.json'];
    const ignoreSubstrings = ['runtimeconfig.json', 'deps.json'];
    // Create hashes from current files in extension directory
    const extensionDir = path.resolve(__dirname, '../../');
    await Promise.all(fileList.map(async (fileName) => {
        if (!fileName.length || ignoreFiles.indexOf(fileName) !== -1 || ignoreSubstrings.some(substring => fileName.toLowerCase().includes(substring))) {
            return;
        }
        const hash = await createHash_1.createHash(path.join(extensionDir, fileName));
        hashTable[fileName] = hash;
    }));
    // Verify that the hashes match those from the manifest
    const allHashesMatch = Object.keys(hashTable).every(fileName => {
        const hashesMatch = (hashTable[fileName] === manifest[fileName]);
        if (!hashesMatch) {
            telemetry_1.Instance.sendFault(acquisitionTelemetry_1.AcquisitionTelemetryEventNames.INSTALL_FAULT, telemetry_1.FaultType.Error, fileName);
            if (traceSource) {
                traceSource.info(`hash mismatch: ${fileName} (${hashTable[fileName]} does not match ${manifest[fileName]} in manifest)`);
            }
        }
        return hashesMatch;
    });
    return !allHashesMatch;
}
exports.isInstallCorrupt = isInstallCorrupt;
async function getCompleteManifest() {
    const extensionDir = path.resolve(__dirname, '../../');
    const externalManifestFile = path.join(extensionDir, 'externalManifest.json');
    const externalManifest = JSON.parse(await fs.readFile(externalManifestFile, { encoding: 'utf-8' }));
    // The external manifest is generated based off of where packages are initially downloaded to.
    // This simulates moving them to their post-install location.
    const packages = packageManager_1.PackageManager.getLiveSharePackages();
    const externalManifestPostMove = {};
    for (const pkg of packages) {
        const pkgFileHashes = externalManifest[pkg.code];
        packageManager_1.PackageManager.moveUnpackedPackageFiles(pkg, (cwd) => {
            return Object.keys(pkgFileHashes);
        }, (sourcePath, targetPath) => {
            const normalizedTargetPath = util.PathUtil.convertToForwardSlashes(path.relative(extensionDir, targetPath));
            externalManifestPostMove[normalizedTargetPath] = pkgFileHashes[sourcePath];
        });
    }
    const manifestFile = path.join(extensionDir, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestFile, { encoding: 'utf-8' }));
    // The extension directory should contain both the files we ship with the extension (those in manifest), and
    // the downloaded and moved package files (those in externalManifest).
    const completeManifest = Object.assign({}, manifest, externalManifestPostMove);
    // The manifest is generated based off the initial location of the files. On first run, we move
    // run-time specific files around. This simulates that.
    ExternalDownloader.installRuntimeSpecificAssets((sourcePath, targetPath) => {
        const normalizedSourcePath = util.PathUtil.convertToForwardSlashes(path.relative(extensionDir, sourcePath));
        const normalizedTargetPath = util.PathUtil.convertToForwardSlashes(path.relative(extensionDir, targetPath));
        completeManifest[normalizedTargetPath] = completeManifest[normalizedSourcePath];
    });
    return completeManifest;
}
exports.getCompleteManifest = getCompleteManifest;

//# sourceMappingURL=downloader.js.map
