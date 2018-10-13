"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const cp = require("child_process");
const os = require("os");
const constants_1 = require("../constants");
const localize_1 = require("../localize");
var cpUtils;
(function (cpUtils) {
    function executeCommand(outputChannel, workingDirectory, command, ...args) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield tryExecuteCommand(outputChannel, workingDirectory, command, ...args);
            if (result.code !== 0) {
                // We want to make sure the full error message is displayed to the user, not just the error code.
                // If outputChannel is defined, then we simply call 'outputChannel.show()' and throw a generic error telling the user to check the output window
                // If outputChannel is _not_ defined, then we include the command's output in the error itself and rely on AzureActionHandler to display it properly
                if (outputChannel) {
                    outputChannel.show();
                    throw new Error(localize_1.localize('azFunc.commandErrorWithOutput', 'Failed to run "{0}" command. Check output window for more details.', command));
                }
                else {
                    throw new Error(localize_1.localize('azFunc.commandError', 'Command "{0} {1}" failed with exit code "{2}":{3}{4}', command, result.formattedArgs, result.code, os.EOL, result.cmdOutputIncludingStderr));
                }
            }
            else {
                if (outputChannel) {
                    outputChannel.appendLine(localize_1.localize('finishedRunningCommand', 'Finished running command: "{0} {1}".', command, result.formattedArgs));
                }
            }
            return result.cmdOutput;
        });
    }
    cpUtils.executeCommand = executeCommand;
    function tryExecuteCommand(outputChannel, workingDirectory, command, ...args) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield new Promise((resolve, reject) => {
                let cmdOutput = '';
                let cmdOutputIncludingStderr = '';
                const formattedArgs = args.join(' ');
                workingDirectory = workingDirectory || os.tmpdir();
                const options = {
                    cwd: workingDirectory,
                    shell: true
                };
                const childProc = cp.spawn(command, args, options);
                if (outputChannel) {
                    outputChannel.appendLine(localize_1.localize('runningCommand', 'Running command: "{0} {1}"...', command, formattedArgs));
                }
                childProc.stdout.on('data', (data) => {
                    data = data.toString();
                    cmdOutput = cmdOutput.concat(data);
                    cmdOutputIncludingStderr = cmdOutputIncludingStderr.concat(data);
                    if (outputChannel) {
                        outputChannel.append(data);
                    }
                });
                childProc.stderr.on('data', (data) => {
                    data = data.toString();
                    cmdOutputIncludingStderr = cmdOutputIncludingStderr.concat(data);
                    if (outputChannel) {
                        outputChannel.append(data);
                    }
                });
                childProc.on('error', reject);
                childProc.on('close', (code) => {
                    resolve({
                        code,
                        cmdOutput,
                        cmdOutputIncludingStderr,
                        formattedArgs
                    });
                });
            });
        });
    }
    cpUtils.tryExecuteCommand = tryExecuteCommand;
    const quotationMark = constants_1.isWindows ? '"' : '\'';
    /**
     * Ensures spaces and special characters (most notably $) are preserved
     */
    function wrapArgInQuotes(arg) {
        return quotationMark + arg + quotationMark;
    }
    cpUtils.wrapArgInQuotes = wrapArgInQuotes;
})(cpUtils = exports.cpUtils || (exports.cpUtils = {}));
//# sourceMappingURL=cpUtils.js.map