"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const mkdirp = require("mkdirp");
const os = require("os");
const path = require("path");
const rimraf = require("rimraf");
const puppeteer = require('puppeteer-core');
const testDataPath = path.resolve(__dirname, '../../uitest/testdata');
let joinIndex = 0;
async function getChromeExePath() {
    const downloadChromeVersion = '576753';
    const browserFetcher = puppeteer.createBrowserFetcher();
    const downloadedRevisions = await browserFetcher.localRevisions();
    if (downloadedRevisions.indexOf(downloadChromeVersion) < 0) {
        // A private copy of Chrome has not been downloaded yet.
        console.log('      Downloading Chrome...');
    }
    const revisionInfo = await browserFetcher.download(downloadChromeVersion);
    return revisionInfo.executablePath;
}
async function launchBrowser(visible) {
    const chromeDataDir = path.join(testDataPath, 'Chrome');
    // Suppress the confirmation prompt for launching vsls links.
    const preferences = {
        protocol_handler: {
            excluded_schemes: {
                vsls: false
            }
        },
    };
    const preferencesFile = path.join(chromeDataDir, 'Default', 'Preferences');
    mkdirp.sync(path.dirname(preferencesFile));
    fs.writeFileSync(preferencesFile, JSON.stringify(preferences));
    const options = {
        executablePath: await getChromeExePath(),
        headless: !visible,
        slowMo: 10,
        userDataDir: chromeDataDir,
    };
    const browser = await puppeteer.launch(options);
    return browser;
}
async function signIn(serviceBaseUri, accountType, username, password, visible) {
    if (!serviceBaseUri) {
        throw new Error('Service base URI is required.');
    }
    else if (!serviceBaseUri.endsWith('/')) {
        serviceBaseUri += '/';
    }
    const signInUri = serviceBaseUri + 'auth/identity/' + accountType;
    const browser = await launchBrowser(visible);
    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();
    await page.goto(signInUri);
    if (accountType === 'microsoft') {
        // This wait is necessary on Windows but hangs on Mac.
        if (process.platform === 'win32')
            await page.waitForNavigation();
        await page.type('input[type="email"]', username + '\n');
        await page.waitForNavigation();
        await page.type('input[type="password"]', password + '\n');
        await page.waitForNavigation();
        if (await page.$('input[name="ucaccept"]')) {
            // Accept the "Let this app access your info" prompt.
            await page.type('input[name="ucaccept"]', '\n');
            await page.waitForNavigation();
        }
    }
    else {
        await page.type('input[name="login"]', username);
        await page.type('input[name="password"]', password + '\n');
        await page.waitForNavigation();
    }
    const userCode = await page.$eval('input[type="text"]', (input) => input.value);
    if (visible) {
        // Wait for a short time in case the code is grabbed from the user title.
        await new Promise(c => setTimeout(c, 1000));
    }
    await browser.close();
    return userCode;
}
exports.signIn = signIn;
async function join(invitationUri, extensionDir, visible) {
    const tempWorkspaceDir = path.join(testDataPath, 'join' + (++joinIndex));
    rimraf.sync(tempWorkspaceDir);
    // Set environment variables that modify the launcher behavior.
    try {
        setLauncherEnv(extensionDir, {
            'VSLS_TEST_WORKSPACE_DIR': tempWorkspaceDir,
            'VSLS_TEST_SKIP_LAUNCH': '1',
        });
        const browser = await launchBrowser(visible);
        const page = await browser.newPage();
        await page.goto(invitationUri);
        // This wait is necessary on Windows but hangs on Mac.
        if (process.platform === 'win32')
            await page.waitForNavigation();
        // Wait for the workspace file to be generated by the launcher.
        let workspaceFile;
        for (let i = 0; i < 7; i++) {
            await new Promise((c) => setTimeout(c, 1000));
            let files;
            try {
                files = fs.readdirSync(tempWorkspaceDir);
            }
            catch (e) {
                files = [];
            }
            workspaceFile = files.find(f => path.extname(f) === '.code-workspace');
            if (workspaceFile) {
                workspaceFile = path.join(tempWorkspaceDir, workspaceFile);
            }
        }
        await browser.close();
        if (!workspaceFile) {
            throw new Error('Launcher was not invoked or did not create a .code-workspace file.');
        }
        return workspaceFile;
    }
    finally {
        setLauncherEnv(extensionDir, {
            'VSLS_TEST_WORKSPACE_DIR': null,
            'VSLS_TEST_SKIP_LAUNCH': null,
        });
    }
}
exports.join = join;
function setLauncherEnv(extensionDir, env) {
    for (let name in env) {
        process.env[name] = env[name];
    }
    // On Mac, the launcher is executed indirectly in a way that it
    // doesn't automatically inherit the process environment.
    // Instead, write environment variables to its `Info.plist` file.
    if (os.platform() === 'darwin') {
        const plistFilePath = path.join(extensionDir, 'node_modules/@vsliveshare/vscode-launcher-osx/' +
            'Live Share for VS Code.app/Contents/Info.plist');
        const plistString = fs.readFileSync(plistFilePath).toString();
        const envXml = Object.keys(env)
            .filter(name => env[name])
            .map(name => `\t\t<key>${name}</key>\n\t\t<string>${env[name]}</string>\n`)
            .join('');
        const modifiedPlistString = plistString.replace(/(\t<key>LSEnvironment<\/key>\n\t)(<dict>[^]*\n\t<\/dict>\n)|(<dict\/>\n)/, `$1<dict>\n${envXml}\t</dict>\n`);
        fs.writeFileSync(plistFilePath, modifiedPlistString);
    }
}

//# sourceMappingURL=web.js.map
