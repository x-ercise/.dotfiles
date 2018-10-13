"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process = require("child_process");
const path = require("path");
const os = require("os");
console.log('Uninstalling launcher...');
const extensionRootPath = path.join(__filename, '..', '..', '..');
const nodeModulesPath = path.join(extensionRootPath, 'node_modules');
const launcherOSXPath = path.join(nodeModulesPath, '@vsliveshare', 'vscode-launcher-osx');
const launcherWinPath = path.join(nodeModulesPath, '@vsliveshare', 'vscode-launcher-win');
const launcherLinuxPath = path.join(nodeModulesPath, '@vsliveshare', 'vscode-launcher-linux');
const uninstallScripts = {
    win32: {
        command: path.join(launcherWinPath, 'Live Share for VS Code.exe'),
        args: ['uninstall']
    }
};
function uninstall() {
    const uninstallScript = uninstallScripts[os.platform()];
    if (!uninstallScript) {
        console.log('No uninstall script found');
        return;
    }
    const command = path.join(launcherWinPath, 'Live Share for VS Code.exe');
    const args = ['uninstall'];
    const cp = child_process.spawn(command, args);
    cp.stdout.on('data', (data) => {
        console.log(data.toString());
    });
    cp.stderr.on('data', (data) => {
        console.log(data.toString());
    });
    cp.on('error', (err) => {
        console.log('failed', err);
    });
    cp.on('close', (exitCode, signal) => {
        console.log('close', exitCode, signal);
    });
}
uninstall();

//# sourceMappingURL=uninstall.js.map
