"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const cp = require("child_process");
const os = require("os");
const path = require("path");
const minimist = require("minimist");
const rimraf = require("rimraf");
const mkdirp = require("mkdirp");
require("source-map-support/register");
const application_1 = require("@vsliveshare/vscode-automation/application");
const logger_1 = require("@vsliveshare/vscode-automation/logger");
const logsDir = path.resolve(__dirname, '../../uitest/logs');
const testDataPath = path.resolve(__dirname, '../../uitest/testdata');
mkdirp.sync(testDataPath);
const [, , ...args] = process.argv;
const opts = minimist(args, {
    string: [
        'vscode-version',
        'wait-time',
        'test-repo',
    ],
    boolean: [
        'verbose',
    ],
    default: {
        verbose: false
    }
});
const testAccount = {
    email: 'vsls-test@outlook.com',
    password: 'ShareAllTheThings!',
};
// Override some internal settings.
const testSettingsFilePath = path.join(testDataPath, 'vsls-settings.json');
const settings = {
    isInternal: true,
    canCollectPII: true,
    teamStatus: 'Test',
    serviceUri: 'https://ppe.liveshare.vsengsaas.visualstudio.com/',
    userSettingsPath: '.vs-liveshare-test-settings.json',
    suppressFirewallPrompts: true,
    showInStatusBar: 'always',
};
fs.writeFileSync(testSettingsFilePath, JSON.stringify(settings, null, '\t'));
process.env.VSLS_SETTINGS_FILE = testSettingsFilePath;
const vscodeLogsDirectory = path.join(testDataPath, 'vscodelogs');
mkdirp.sync(vscodeLogsDirectory);
process.env.VSCODE_LOGS = vscodeLogsDirectory;
const workspaceFilePath = path.join(testDataPath, 'uitest.code-workspace');
const testRepoUrl = 'https://github.com/Microsoft/vscode-smoketest-express';
const workspacePath = path.join(testDataPath, 'vscode-smoketest-express');
let extensionsPath = path.join(path.resolve(__dirname, '../../..'));
function fail(errorMessage) {
    console.error(errorMessage);
    process.exit(1);
}
if (parseInt(process.version.substr(1)) < 6) {
    fail('Update to Node >= 6 to run the UI test.');
}
function getVsCodeDir(insiders) {
    const suffix = (insiders ? ' Insiders' : '');
    switch (process.platform) {
        case 'darwin':
            return '/Applications/Visual Studio Code' + suffix + '.app';
        case 'linux':
            return '/snap/vscode/current/usr/share/code';
        case 'win32':
            const codeDirName = 'Microsoft VS Code' + suffix;
            const machineInstallDir = path.join(process.env.ProgramFiles, codeDirName);
            const userInstallDir = path.join(process.env.LocalAppData, 'Programs', codeDirName);
            return fs.existsSync(userInstallDir) ? userInstallDir : machineInstallDir;
        default:
            throw new Error('Unsupported platform.');
    }
}
const vscodeDataDir = path.join(testDataPath, 'VSCode');
const vscodeUserDataDir = path.join(vscodeDataDir, 'User');
rimraf.sync(vscodeUserDataDir);
mkdirp.sync(vscodeUserDataDir);
rimraf.sync(path.join(vscodeDataDir, 'Local Storage'));
// Initialize the VS Code user settings file.
const initialVSCodeSettings = {
    'liveshare.diagnosticLogging': true,
};
const vscodeSettingsFilePath = path.join(vscodeUserDataDir, 'settings.json');
fs.writeFileSync(vscodeSettingsFilePath, JSON.stringify(initialVSCodeSettings, null, '\t'));
// Initialize the VS Code keybindings file.
const keybindings = [
    { 'key': 'ctrl+shift+alt+f1', 'command': 'liveshare.executeCommand' },
];
const vscodeKeybindingsFilePath = path.join(vscodeUserDataDir, 'keybindings.json');
fs.writeFileSync(vscodeKeybindingsFilePath, JSON.stringify(keybindings, null, '\t'));
// Set some environment variables that configure test-only behavior in the VSLS extension.
process.env.VSLS_TEST_DELAY_RELOAD = '1';
process.env.VSLS_TEST_ENABLE_COMMANDS = '1';
process.env.VSLS_TEST_DISABLE_MODAL = '1';
process.env.VSLS_TEST_DISABLE_BROWSE = '1';
function toUri(path) {
    if (process.platform === 'win32') {
        return `${path.replace(/\\/g, '/')}`;
    }
    return `${path}`;
}
async function createWorkspaceFile() {
    if (fs.existsSync(workspaceFilePath)) {
        return;
    }
    console.log('*** Creating workspace file...');
    const workspace = {
        folders: [
            {
                path: toUri(path.join(workspacePath, 'public'))
            },
            {
                path: toUri(path.join(workspacePath, 'routes'))
            },
            {
                path: toUri(path.join(workspacePath, 'views'))
            }
        ]
    };
    fs.writeFileSync(workspaceFilePath, JSON.stringify(workspace, null, '\t'));
}
async function setupRepository() {
    if (opts['test-repo']) {
        console.log('*** Copying test workspace repository:', opts['test-repo']);
        rimraf.sync(workspacePath);
        // not platform friendly
        cp.execSync(`cp -R "${opts['test-repo']}" "${workspacePath}"`);
    }
    else {
        if (!fs.existsSync(workspacePath)) {
            console.log('*** Cloning test workspace repository...');
            cp.spawnSync('git', ['clone', testRepoUrl, workspacePath]);
            console.log('*** Running npm install...');
            cp.execSync('npm install', { cwd: workspacePath, stdio: 'inherit' });
        }
        else {
            console.log('*** Cleaning test workspace repository...');
            cp.spawnSync('git', ['fetch'], { cwd: workspacePath });
            cp.spawnSync('git', ['reset', '--hard', 'FETCH_HEAD'], { cwd: workspacePath });
            cp.spawnSync('git', ['clean', '-xdf', '-e', 'node_modules'], { cwd: workspacePath });
        }
    }
}
async function setupTestWorkspace() {
    console.log('*** Test workspace path:', workspacePath);
    console.log('*** Preparing test workspace...');
    await createWorkspaceFile();
    await setupRepository();
    console.log('*** Test workspace ready\n');
}
function createApp(codeDir, logger) {
    if (!codeDir || !fs.existsSync(codeDir)) {
        fail(`Can't find VS Code directory at ${codeDir}.`);
    }
    let quality;
    if (codeDir.indexOf('Code - Insiders') >= 0 /* macOS/Windows */ ||
        codeDir.indexOf('code-insiders') >= 0 /* Linux */) {
        quality = application_1.Quality.Insiders;
    }
    else {
        quality = application_1.Quality.Stable;
    }
    return new application_1.Application({
        quality,
        codePath: codeDir,
        workspacePath,
        userDataDir: vscodeDataDir,
        extensionsPath,
        workspaceFilePath,
        waitTime: parseInt(opts['wait-time'] || '0') || 20,
        logger: logger,
        verbose: false,
    });
}
function createLogger() {
    const loggers = [];
    if (opts.verbose) {
        loggers.push(new logger_1.ConsoleLogger());
    }
    rimraf.sync(logsDir);
    try {
        mkdirp.sync(logsDir);
    }
    catch (e) { } // A permission error is possible if the directory is in use.
    loggers.push(new logger_1.FileLogger(path.join(logsDir, 'uitest.log')));
    return new logger_1.MultiLogger(loggers);
}
before(async function () {
    // allow two minutes for setup
    this.timeout(2 * 60 * 1000);
    await setupTestWorkspace();
    this.extensionDir = (await setupExtensions()) || path.resolve(__dirname, '../..');
    // If launched by VS Code, use the same installation of VS Code for tests.
    const parentApp = await new Promise((resolve, reject) => {
        const ps = require('ps-node');
        ps.lookup({ pid: process.ppid }, (err, results) => {
            if (err) {
                reject(err);
            }
            else {
                const parentProcess = results[0];
                if (parentProcess) {
                    resolve(parentProcess.command);
                }
                else {
                    resolve(null);
                }
            }
        });
    });
    let vscodeDir;
    if (parentApp && path.basename(parentApp).toLowerCase().startsWith('code')) {
        console.log('Using parent VS Code.');
        vscodeDir = path.dirname(parentApp);
    }
    else if (opts['vscode-version']) {
        vscodeDir = await downloadVscode(opts['vscode-version']);
    }
    else {
        vscodeDir = getVsCodeDir(false);
        console.log('Using VS Code: ' + vscodeDir);
    }
    // Pass the app to the tests via context.
    const logger = createLogger();
    logger.log('Launching VS Code from ' + vscodeDir);
    this.logger = logger;
    this.logsDir = logsDir;
    this.app = createApp(vscodeDir, logger);
    this.serviceUri = settings.serviceUri;
    this.testAccount = testAccount;
    this.settingsFilePath = vscodeSettingsFilePath;
});
after(async function () {
    if (this.app) {
        await this.app.stop();
    }
});
async function captureScreenshots(app, targetDir) {
    const driver = app._code.driver;
    const windowIds = await driver.getWindowIds();
    for (let i = 0; i < windowIds.length; i++) {
        // By convention, the first window is the host and all others are guest(s).
        const role = (i === 0 ? 'host' : ('guest' + (windowIds.length > 2 ? i : '')));
        const screenshotPath = path.join(targetDir, `screenshot-${role}.png`);
        const raw = await driver.capturePage(windowIds[i]);
        const buffer = new Buffer(raw, 'base64');
        fs.writeFileSync(screenshotPath, buffer);
    }
}
function collectLogs() {
    let testName;
    let testStartTime;
    const vslsLogsDir = path.join(os.tmpdir(), 'VSFeedbackVSRTCLogs');
    let failuresDetected = false;
    beforeEach(function () {
        testName = this.currentTest.fullTitle().replace(' ', '.');
        testStartTime = new Date();
        const logger = this.logger;
        logger.log(os.EOL);
        logger.log(`*** Test start: ${testName}`);
    });
    afterEach(async function () {
        const logger = this.logger;
        if (this.currentTest.state === 'failed') {
            failuresDetected = true;
            const testLogsDir = path.join(logsDir, testName);
            try {
                mkdirp.sync(testLogsDir);
            }
            catch (e) { }
            await captureScreenshots(this.app, testLogsDir);
            // Copy any log files that were modified after the test started into the test logs dir.
            fs.readdirSync(vslsLogsDir).forEach((logFile) => {
                if (logFile.endsWith('.log')) {
                    const logStat = fs.statSync(path.join(vslsLogsDir, logFile));
                    if (logStat.mtime >= testStartTime) {
                        fs.copyFileSync(path.join(vslsLogsDir, logFile), path.join(testLogsDir, logFile));
                    }
                }
            });
        }
        logger.log(`*** Test ${this.currentTest.state}: ${testName}${os.EOL}`);
    });
    after(function () {
        if (failuresDetected) {
            console.log('  Logs and screenshots for failed tests: ' + logsDir);
        }
    });
}
async function downloadVscode(version) {
    const download = require('download');
    const platform = 'win32-x64-archive'; // TODO: Other platforms
    const stability = /-insiders/.test(version) ? 'insiders' : 'stable';
    const downloadUrl = `https://vscode-update.azurewebsites.net/${version}/${platform}/${stability}`;
    const downloadDir = path.join(testDataPath, 'VSCode');
    const packagePath = path.join(downloadDir, `vscode-${version}.zip`);
    if (!fs.existsSync(packagePath)) {
        console.log(`*** Downloading VS Code ${version}`);
        mkdirp.sync(downloadDir);
        await new Promise((resolve, reject) => {
            download(downloadUrl, null, { followRedirect: true })
                .pipe(fs.createWriteStream(packagePath))
                .on('close', resolve)
                .on('error', reject);
        });
    }
    const extractDir = path.join(downloadDir, version);
    if (!fs.existsSync(extractDir)) {
        console.log(`*** Unpacking VS Code to ${extractDir}`);
        const unzip = require('extract-zip');
        await new Promise((resolve, reject) => {
            unzip(packagePath, { dir: extractDir }, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    return extractDir;
}
async function setupExtensions() {
    let vslsExtensionDir = null;
    const extensionPackages = opts._.filter((arg) => arg.toLowerCase().endsWith('.vsix'));
    if (extensionPackages.length > 0) {
        // Extension packages were specified on the command-line.
        // Unpack the extensions to a new directory instead of using
        // the extensions in the repo.
        extensionsPath = path.join(testDataPath, 'extensions');
        rimraf.sync(extensionsPath);
        mkdirp.sync(extensionsPath);
        for (let extensionPackage of extensionPackages) {
            console.log(`*** Unpacking ${path.basename(extensionPackage)}`);
            const extensionDir = path.join(extensionsPath, path.basename(extensionPackage, path.extname(extensionPackage)));
            const unzip = require('extract-zip');
            await new Promise((resolve, reject) => {
                // Remap the path of each file to remove the 'extension/' prefix.
                const onEntry = (entry) => {
                    if (entry.fileName.startsWith('extension/')) {
                        entry.fileName = entry.fileName.substr(10);
                    }
                };
                unzip(extensionPackage, { dir: extensionDir, onEntry }, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            if (path.basename(extensionPackage).startsWith('vsliveshare-')) {
                vslsExtensionDir = extensionDir;
            }
        }
    }
    return vslsExtensionDir;
}
function runTests() {
    // Required tests always come first.
    const requiredTests = ['launch'];
    // Initial tests are ordered before other tests, but only if they are being run.
    const initialTests = ['signin', 'join'];
    // A list of test suites to include may be specified on the command-line.
    const includeTests = opts._.filter((arg) => !arg.startsWith('--') && !arg.toLowerCase().endsWith('.vsix'));
    const sourceFiles = fs.readdirSync(__dirname);
    let testSuites = sourceFiles
        .filter((t) => t.endsWith('.test.js'))
        .map((t) => (t).substr(0, t.length - 8));
    if (includeTests && includeTests.length > 0) {
        testSuites = testSuites.filter((t) => includeTests.indexOf(t) >= 0);
    }
    initialTests.reverse().forEach((t) => {
        if (testSuites.indexOf(t) >= 0) {
            testSuites.splice(testSuites.indexOf(t), 1);
            testSuites.splice(0, 0, t);
        }
    });
    requiredTests.reverse().forEach((t) => {
        if (testSuites.indexOf(t) >= 0) {
            testSuites.splice(testSuites.indexOf(t), 1);
        }
        testSuites.splice(0, 0, t);
    });
    testSuites.forEach((t) => require(`./${t}.test`));
}
collectLogs();
runTests();

//# sourceMappingURL=uitest.js.map
