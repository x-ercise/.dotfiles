"use strict";
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs-extra");
const path = require("path");
const tmp = require("tmp");
const util_1 = require("./util");
const util = require("./util");
const traceSource_1 = require("./tracing/traceSource");
const unzip = require("better-unzip");
const tar = require("tar");
const crypto = require("crypto");
const glob = require("glob");
const os = require("os");
const vscode = require("vscode");
let download = function (url, destination, options) {
    // The 'npm-conf' package, a transitive dependency of the 'download' package,
    // changes `process.env.HOME`, which can cause problems for other extensions
    // in the same host process. There's no way to avoid it while still using the
    // 'download' package. So as a workaround this wrapper restores the env variable
    // after importing the package.
    const homeEnv = process.env.HOME;
    // Overwite the download variable so any future invocations skip this wrapper.
    download = require('download');
    if (homeEnv)
        process.env.HOME = homeEnv;
    else
        delete process.env.HOME;
    return download(url, destination, options);
};
class PackageError extends Error {
    // Do not put PII (personally identifiable information) in the 'message' field as it will be logged to telemetry
    constructor(message, pkg = null, innerError = null) {
        super(message);
        this.message = message;
        this.pkg = pkg;
        this.innerError = innerError;
    }
}
exports.PackageError = PackageError;
class PackageManager {
    constructor(platform, architecture, packageJSON) {
        this.platform = platform;
        this.architecture = architecture;
        this.packageJSON = packageJSON;
        this.packageStats = {};
        this.tempPath = 'temp';
        if (this.packageJSON.runtimeDependencies) {
            this.allPackages = this.packageJSON.runtimeDependencies;
        }
        else {
            throw (new PackageError('Package manifest does not exist.'));
        }
        // Ensure our temp files get cleaned up in case of error.
        tmp.setGracefulCleanup();
    }
    get stats() {
        return this.packageStats;
    }
    static getLiveSharePackages() {
        const packageJSON = vscode.extensions.getExtension('ms-vsliveshare.vsliveshare').packageJSON;
        const platform = os.platform();
        const arch = os.arch();
        if (packageJSON.runtimeDependencies) {
            const allPackages = packageJSON.runtimeDependencies;
            return allPackages.filter(pkg => {
                if (pkg.architectures && pkg.architectures.indexOf(arch) === -1) {
                    return false;
                }
                if (pkg.platforms && pkg.platforms.indexOf(platform) === -1) {
                    return false;
                }
                return true;
            });
        }
        else {
            throw (new PackageError('Package manifest does not exist.'));
        }
    }
    getPackages() {
        let list = this.allPackages;
        return list.filter(pkg => {
            if (pkg.architectures && pkg.architectures.indexOf(this.architecture) === -1) {
                return false;
            }
            if (pkg.platforms && pkg.platforms.indexOf(this.platform) === -1) {
                return false;
            }
            return true;
        });
    }
    async downloadPackagesAsync(status) {
        const packages = this.getPackages();
        for (const pkg of packages) {
            this.stats[pkg.code] = {};
            await this.maybeDownloadPackageAsync(pkg, status);
        }
    }
    async installPackagesAsync(status) {
        const packages = this.getPackages();
        for (const pkg of packages) {
            await this.installPackageAsync(pkg, status);
        }
    }
    static getBaseInstallPath(pkg) {
        let basePath = util_1.ExtensionUtil.Context.extensionPath;
        if (pkg.installPath) {
            basePath = path.join(basePath, pkg.installPath);
        }
        return basePath;
    }
    static getBaseUnpackPath(basePath, pkg) {
        if (pkg.unpackPath) {
            basePath = path.join(basePath, pkg.unpackPath);
        }
        return basePath;
    }
    getBaseRetryDeletePath(basePath, baseUnpackPath, pkg) {
        if (pkg.retryDeletePath) {
            return path.join(basePath, pkg.retryDeletePath);
        }
        if (basePath !== baseUnpackPath) {
            return baseUnpackPath;
        }
    }
    async maybeDownloadPackageAsync(pkg, status) {
        // TODO: add config setting to force download
        let shouldDownload = !await this.doesPackageTestPathExistAsync(pkg);
        if (shouldDownload) {
            await this.downloadPackageAsync(pkg, status);
        }
        else {
            traceSource_1.traceSource.info(`Skipping package '${pkg.description}' (already downloaded).`);
        }
        this.stats[pkg.code].didDownload = shouldDownload;
    }
    async downloadPackageAsync(pkg, status) {
        traceSource_1.traceSource.info(`Downloading package '${pkg.description}' `);
        status.setMessage('Finishing VS Live Share installation (downloading)...');
        pkg.tmpFile = await this.createTempFile(pkg);
        await this.downloadFileAsync(pkg.url, pkg);
        traceSource_1.traceSource.info('Download complete.');
    }
    async downloadFileAsync(urlString, pkg) {
        if (!pkg.tmpFile || pkg.tmpFile.fd === 0) {
            throw new PackageError('Temporary package file unavailable', pkg);
        }
        try {
            if (await util_1.ExtensionUtil.isCommandDefined('_workbench.downloadResource')) {
                this.stats[pkg.code].vscodeDownload = true;
                await vscode.commands.executeCommand('_workbench.downloadResource', vscode.Uri.parse(urlString)).then((location) => {
                    fs.copyFileSync(location.fsPath, pkg.tmpFile.name);
                });
                let data = await fs.readFile(pkg.tmpFile.name);
                this.ensurePkgHashMatches(data, pkg);
            }
            else {
                this.stats[pkg.code].vscodeDownload = false;
                let data = await download(urlString, null, { followRedirect: true });
                this.ensurePkgHashMatches(data, pkg);
                fs.writeFileSync(pkg.tmpFile.name, data);
            }
        }
        catch (err) {
            throw new PackageError(`Reponse error: ${err.message || 'NONE'}`, pkg, err);
        }
    }
    ensurePkgHashMatches(data, pkg) {
        let hash = crypto.createHash('sha256').update(data).digest('hex');
        let hasMatch = hash === pkg.checksum;
        this.stats[pkg.code].checksumPass = hasMatch;
        if (!hasMatch) {
            throw new PackageError('Checksum does not match for ' + pkg.description, pkg);
        }
    }
    createTempFile(pkg) {
        return new Promise((resolve, reject) => {
            tmp.file({ prefix: 'package-' }, (err, tmpPath, fd, cleanupCallback) => {
                if (err) {
                    return reject(new PackageError('Error from tmp.file', pkg, err));
                }
                resolve({ name: tmpPath, fd: fd, removeCallback: cleanupCallback });
            });
        });
    }
    doesPackageTestPathExistAsync(pkg) {
        const testPath = this.getPackageTestPath(pkg);
        if (testPath) {
            return util.fileExistsAsync(testPath);
        }
        else {
            return Promise.resolve(false);
        }
    }
    getPackageTestPath(pkg) {
        if (pkg.installTestPath) {
            return path.join(util_1.ExtensionUtil.Context.extensionPath, pkg.installTestPath);
        }
        else {
            return null;
        }
    }
    async installPackageAsync(pkg, status) {
        if (!pkg.tmpFile) {
            // Download of this package was skipped, so there is nothing to install
            return;
        }
        traceSource_1.traceSource.info(`Installing package '${pkg.description}'`);
        status.setMessage('Finishing VS Live Share installation (installing)...');
        try {
            if (pkg.tmpFile.fd === 0) {
                throw new PackageError('Downloaded file unavailable', pkg);
            }
            const baseInstallPath = PackageManager.getBaseInstallPath(pkg);
            const baseUnpackPath = PackageManager.getBaseUnpackPath(baseInstallPath, pkg);
            const baseRetryDeletePath = this.getBaseRetryDeletePath(baseInstallPath, baseUnpackPath, pkg);
            await this.ensureCleanUnpackPath(baseRetryDeletePath);
            const baseFilesPreUnpack = PackageManager.getAllFilesSync(baseUnpackPath);
            this.stats[pkg.code].totalBaseFilesPreUnpack = baseFilesPreUnpack.length;
            await this.unpackDownloadedPackage(pkg, baseUnpackPath);
            const baseFilesPostUnpack = this.getAllRelativeFilesSync(baseUnpackPath);
            const filesAdded = baseFilesPostUnpack.length - baseFilesPreUnpack.length;
            this.stats[pkg.code].totalBaseFilesPostUnpack = baseFilesPostUnpack.length;
            this.stats[pkg.code].totalFilesExtracted = filesAdded;
            if (pkg.packageRootPath) {
                const baseFilesPreMove = PackageManager.getAllFilesSync(baseInstallPath);
                this.stats[pkg.code].totalBaseFilesPreMove = baseFilesPreMove.length;
                PackageManager.moveUnpackedPackageFiles(pkg, (cwd) => {
                    return PackageManager.getAllFilesSync(cwd);
                }, (sourcePath, targetPath) => {
                    util.moveElseThrowSync(sourcePath, targetPath);
                });
                const baseFilesPostMove = PackageManager.getAllFilesSync(baseInstallPath);
                this.stats[pkg.code].totalBaseFilesPostMove = baseFilesPostMove.length;
                this.stats[pkg.code].totalFileMovedOffset = baseFilesPreMove.length - baseFilesPostMove.length;
            }
            traceSource_1.traceSource.info('Finished installing.');
        }
        catch (err) {
            // If anything goes wrong with unzip, make sure we delete the test path (if there is one)
            // so we will retry again later
            const testPath = this.getPackageTestPath(pkg);
            if (testPath) {
                fs.unlink(testPath, err => { });
            }
            throw err;
        }
        finally {
            // Clean up temp file
            pkg.tmpFile.removeCallback();
        }
    }
    async ensureCleanUnpackPath(baseRetryDeletePath) {
        if (baseRetryDeletePath && await fs.pathExists(baseRetryDeletePath)) {
            await fs.remove(baseRetryDeletePath);
            traceSource_1.traceSource.info('Cleaned old files from install path.');
        }
    }
    async unpackDownloadedPackage(pkg, baseUnpackPath) {
        if (pkg.url.endsWith('zip')) {
            await this.unzipPackageAsync(pkg, baseUnpackPath);
        }
        else if (pkg.url.endsWith('tar.gz')) {
            await this.untarPackageAsync(pkg, baseUnpackPath);
        }
        traceSource_1.traceSource.verbose('Extracted packed files');
    }
    unzipPackageAsync(pkg, baseUnpackPath) {
        return new Promise((resolve, reject) => {
            fs.createReadStream(pkg.tmpFile.name)
                .pipe(unzip.Extract({ path: baseUnpackPath }))
                .on('close', () => {
                resolve();
            })
                .on('error', (zipErr) => {
                reject(new PackageError('Zip File Error:' + zipErr.code || '', pkg, zipErr));
            });
        });
    }
    async untarPackageAsync(pkg, baseUnpackPath) {
        try {
            await fs.ensureDir(baseUnpackPath);
            await tar.extract({ cwd: baseUnpackPath, file: pkg.tmpFile.name }, [pkg.packageRootPath]);
        }
        catch (err) {
            throw new PackageError('Zip File Error:' + err.code || '', pkg, err);
        }
    }
    static moveUnpackedPackageFiles(pkg, getAllFiles, moveFn) {
        const baseInstallPath = PackageManager.getBaseInstallPath(pkg);
        const baseUnpackPath = PackageManager.getBaseUnpackPath(baseInstallPath, pkg);
        let files = getAllFiles(baseUnpackPath);
        files.forEach((f) => {
            let targetPath = path.join(baseInstallPath, path.basename(f));
            moveFn(f, targetPath);
        });
        traceSource_1.traceSource.info(`Moved package files.`);
    }
    static getAllFilesSync(cwd) {
        return glob.sync('**/*', { cwd, nodir: true, absolute: true, dot: true });
    }
    getAllRelativeFilesSync(cwd) {
        return glob.sync('**/*', { cwd, nodir: true, absolute: false, dot: true });
    }
}
exports.PackageManager = PackageManager;

//# sourceMappingURL=packageManager.js.map
