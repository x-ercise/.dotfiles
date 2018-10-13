"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const util = require("../util");
const os = require("os");
const launcher_1 = require("../launcher");
/*
Class helper to implement a custom DebugAdapterExecutable instance that would pass addtional arguments
to our debug host adapter
*/
class AdapterExecutableProvider {
    constructor(debugAdapterAssembly, trace) {
        this.debugAdapterAssembly = debugAdapterAssembly;
        this.trace = trace;
        this.callbacks = [];
    }
    debugAdapterExecutable(folder, token) {
        let adapterBinPath = path.join(launcher_1.Launcher.extensionRootPath, 'dotnet_modules', this.debugAdapterAssembly);
        if (os.platform() === util.OSPlatform.WINDOWS) {
            adapterBinPath += '.exe';
        }
        let args = this.adapterArguments;
        // If the args are undefined it is mostly because vscode is calling multiple times
        // this method without calling resolveDebugConfiguration (as the case when using 'extensionHost')
        if (args === undefined) {
            args = this.lastAdapterArguments;
        }
        else {
            this.lastAdapterArguments = args;
        }
        this.adapterArguments = undefined;
        // If there are multiple launch configurations
        // invoke the next callback to continue resolving
        // debug configurations
        const callback = this.callbacks.shift();
        if (callback) {
            callback();
        }
        this.trace.info(`->debugAdapterExecutable path:${adapterBinPath} args:${JSON.stringify(args)}`);
        return new vscode.DebugAdapterExecutable(adapterBinPath, args);
    }
    // Sets adapter arguments to be used by debugAdapterExecutable.
    // Force debugAdapterExecutable to complete one debug configuration before setting
    // adapter arguments for the next one.
    async setAdapterArguments(args) {
        this.trace.info(`->setAdapterArguments args:${JSON.stringify(args)}`);
        if (this.adapterArguments !== undefined) {
            await new Promise((resolve, reject) => this.callbacks.push(() => resolve()));
        }
        this.adapterArguments = args;
    }
}
exports.AdapterExecutableProvider = AdapterExecutableProvider;

//# sourceMappingURL=adapterExecutableProvider.js.map
