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
const fse = require("fs-extra");
const os = require("os");
const path = require("path");
const semver = require("semver");
const vscode_1 = require("vscode");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const constants_1 = require("../../constants");
const extensionVariables_1 = require("../../extensionVariables");
const validateFuncCoreToolsInstalled_1 = require("../../funcCoreTools/validateFuncCoreToolsInstalled");
const LocalAppSettings_1 = require("../../LocalAppSettings");
const localize_1 = require("../../localize");
const cpUtils_1 = require("../../utils/cpUtils");
const fsUtil = require("../../utils/fs");
const IProjectCreator_1 = require("./IProjectCreator");
const ScriptProjectCreatorBase_1 = require("./ScriptProjectCreatorBase");
exports.funcEnvName = 'func_env';
var PythonAlias;
(function (PythonAlias) {
    PythonAlias["python"] = "python";
    PythonAlias["python3"] = "python3";
    PythonAlias["py"] = "py";
})(PythonAlias = exports.PythonAlias || (exports.PythonAlias = {}));
const minPythonVersion = '3.6.0';
const minPythonVersionLabel = '3.6.x'; // Use invalid semver as the label to make it more clear that any patch version is allowed
class PythonProjectCreator extends ScriptProjectCreatorBase_1.ScriptProjectCreatorBase {
    constructor() {
        super(...arguments);
        this.templateFilter = constants_1.TemplateFilter.Verified;
        this.preDeployTask = constants_1.funcPackId;
    }
    getLaunchJson() {
        return {
            version: '0.2.0',
            configurations: [
                {
                    name: localize_1.localize('azFunc.attachToJavaScriptFunc', 'Attach to Python Functions'),
                    type: 'python',
                    request: 'attach',
                    port: 9091,
                    host: 'localhost',
                    preLaunchTask: IProjectCreator_1.funcHostTaskId
                }
            ]
        };
    }
    getRuntime() {
        return __awaiter(this, void 0, void 0, function* () {
            // Python only works on v2
            return constants_1.ProjectRuntime.v2;
        });
    }
    addNonVSCodeFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            const funcCoreRequired = localize_1.localize('funcCoreRequired', 'Azure Functions Core Tools must be installed to create, debug, and deploy local Python Functions projects.');
            if (!(yield validateFuncCoreToolsInstalled_1.validateFuncCoreToolsInstalled(true /* forcePrompt */, funcCoreRequired))) {
                throw new vscode_azureextensionui_1.UserCancelledError();
            }
            let createVenv = false;
            if (yield fse.pathExists(path.join(this.functionAppPath, exports.funcEnvName))) {
                const input = yield extensionVariables_1.ext.ui.showWarningMessage(localize_1.localize('funcEnvExists', 'Python virtual environment "{0}" already exists. Overwrite?', exports.funcEnvName), { modal: true }, vscode_azureextensionui_1.DialogResponses.yes, vscode_azureextensionui_1.DialogResponses.no, vscode_azureextensionui_1.DialogResponses.cancel);
                createVenv = input === vscode_azureextensionui_1.DialogResponses.yes;
            }
            else {
                createVenv = true;
            }
            if (createVenv) {
                yield createVirtualEnviornment(this.functionAppPath);
            }
            yield this.createPythonProject();
        });
    }
    getTasksJson() {
        return __awaiter(this, void 0, void 0, function* () {
            // setting the deploySubpath to the result of the 'funcPack' task included below
            this.deploySubpath = `${path.basename(this.functionAppPath)}.zip`;
            // func host task requires this
            yield makeVenvDebuggable(this.functionAppPath);
            // func pack task may fail with "The process cannot access the file because it is being used by another process." unless venv is in '.funcignore' file
            yield this.ensureVenvInFuncIgnore();
            const funcPackCommand = 'func pack';
            const funcHostStartCommand = 'func host start';
            const funcExtensionsCommand = 'func extensions install';
            return {
                version: '2.0.0',
                tasks: [
                    {
                        label: localize_1.localize('azFunc.runFuncHost', 'Run Functions Host'),
                        identifier: IProjectCreator_1.funcHostTaskId,
                        type: 'shell',
                        osx: {
                            command: `${funcExtensionsCommand} && ${convertToVenvCommand(funcHostStartCommand, constants_1.Platform.MacOS)}`
                        },
                        windows: {
                            command: `${funcExtensionsCommand} ; ${convertToVenvCommand(funcHostStartCommand, constants_1.Platform.Windows)}`
                        },
                        linux: {
                            command: `${funcExtensionsCommand} && ${convertToVenvCommand(funcHostStartCommand, constants_1.Platform.Linux)}`
                        },
                        isBackground: true,
                        presentation: {
                            reveal: 'always'
                        },
                        options: {
                            env: {
                                // tslint:disable-next-line:no-invalid-template-strings
                                'languageWorkers:python:arguments': '-m ptvsd --server --port 9091 --file'
                            }
                        },
                        problemMatcher: IProjectCreator_1.funcWatchProblemMatcher
                    },
                    {
                        label: constants_1.funcPackId,
                        identifier: constants_1.funcPackId,
                        type: 'shell',
                        osx: {
                            command: convertToVenvCommand(funcPackCommand, constants_1.Platform.MacOS)
                        },
                        windows: {
                            command: convertToVenvCommand(funcPackCommand, constants_1.Platform.Windows)
                        },
                        linux: {
                            command: convertToVenvCommand(funcPackCommand, constants_1.Platform.Linux)
                        },
                        isBackground: true,
                        presentation: {
                            reveal: 'always'
                        }
                    }
                ]
            };
        });
    }
    getRecommendedExtensions() {
        return super.getRecommendedExtensions().concat(['ms-python.python']);
    }
    createPythonProject() {
        return __awaiter(this, void 0, void 0, function* () {
            yield runPythonCommandInVenv(this.functionAppPath, 'func init ./ --worker-runtime python');
            // .gitignore is created by `func init`
            const gitignorePath = path.join(this.functionAppPath, constants_1.gitignoreFileName);
            if (yield fse.pathExists(gitignorePath)) {
                const pythonPackages = '.python_packages';
                let writeFile = false;
                let gitignoreContents = (yield fse.readFile(gitignorePath)).toString();
                // the func_env and ._python_packages are recreated and should not be checked in
                if (!gitignoreContents.includes(exports.funcEnvName)) {
                    extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('gitAddFunc_Env', 'Adding "{0}" to .gitignore...', exports.funcEnvName));
                    gitignoreContents = gitignoreContents.concat(`${os.EOL}${exports.funcEnvName}`);
                    writeFile = true;
                }
                if (!gitignoreContents.includes(pythonPackages)) {
                    extensionVariables_1.ext.outputChannel.appendLine(localize_1.localize('gitAddPythonPackages', 'Adding "{0}" to .gitignore...', pythonPackages));
                    gitignoreContents = gitignoreContents.concat(`${os.EOL}${pythonPackages}`);
                    writeFile = true;
                }
                if (writeFile) {
                    yield fse.writeFile(gitignorePath, gitignoreContents);
                }
            }
            if (!constants_1.isWindows) {
                // Make sure local settings isn't using Storage Emulator for non-windows
                // https://github.com/Microsoft/vscode-azurefunctions/issues/583
                const localSettingsPath = path.join(this.functionAppPath, constants_1.localSettingsFileName);
                const localSettings = yield LocalAppSettings_1.getLocalSettings(localSettingsPath);
                // tslint:disable-next-line:strict-boolean-expressions
                localSettings.Values = localSettings.Values || {};
                localSettings.Values[LocalAppSettings_1.azureWebJobsStorageKey] = '';
                yield fsUtil.writeFormattedJson(localSettingsPath, localSettings);
            }
        });
    }
    ensureVenvInFuncIgnore() {
        return __awaiter(this, void 0, void 0, function* () {
            const funcIgnorePath = path.join(this.functionAppPath, '.funcignore');
            let funcIgnoreContents;
            if (yield fse.pathExists(funcIgnorePath)) {
                funcIgnoreContents = (yield fse.readFile(funcIgnorePath)).toString();
                if (funcIgnoreContents && !funcIgnoreContents.includes(exports.funcEnvName)) {
                    funcIgnoreContents = funcIgnoreContents.concat(`${os.EOL}${exports.funcEnvName}`);
                }
            }
            if (!funcIgnoreContents) {
                funcIgnoreContents = exports.funcEnvName;
            }
            yield fse.writeFile(funcIgnorePath, funcIgnoreContents);
        });
    }
}
exports.PythonProjectCreator = PythonProjectCreator;
/**
 * Returns undefined if valid or an error message if not
 */
function validatePythonAlias(pyAlias) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield cpUtils_1.cpUtils.tryExecuteCommand(undefined /*don't display output*/, undefined /*default to cwd*/, `${pyAlias} --version`);
            if (result.code !== 0) {
                return localize_1.localize('failValidate', 'Failed to validate version: {0}', result.cmdOutputIncludingStderr);
            }
            const matches = result.cmdOutputIncludingStderr.match(/^Python (\S*)/i);
            if (matches === null || !matches[1]) {
                return localize_1.localize('failedParse', 'Failed to parse version: {0}', result.cmdOutputIncludingStderr);
            }
            else {
                const pyVersion = matches[1];
                if (semver.gte(pyVersion, minPythonVersion)) {
                    return undefined;
                }
                else {
                    return localize_1.localize('tooLowVersion', 'Python version "{0}" is below minimum version of "{1}".', pyVersion, minPythonVersion);
                }
            }
        }
        catch (error) {
            return vscode_azureextensionui_1.parseError(error).message;
        }
    });
}
function convertToVenvCommand(command, platform, separator) {
    switch (platform) {
        case constants_1.Platform.Windows:
            // tslint:disable-next-line:strict-boolean-expressions
            return `${path.join('.', exports.funcEnvName, 'Scripts', 'activate')} ${separator || ';'} ${command}`;
        default:
            // tslint:disable-next-line:strict-boolean-expressions
            return `. ${path.join('.', exports.funcEnvName, 'bin', 'activate')} ${separator || '&&'} ${command}`;
    }
}
function getPythonAlias() {
    return __awaiter(this, void 0, void 0, function* () {
        for (const key of Object.keys(PythonAlias)) {
            const alias = PythonAlias[key];
            const errorMessage = yield validatePythonAlias(alias);
            if (!errorMessage) {
                return alias;
            }
        }
        const enterPython = { title: localize_1.localize('enterPython', 'Enter Python Path') };
        const pythonMsg = localize_1.localize('pythonVersionRequired', 'Python {0} is required to create a Python Function project and was not found.', minPythonVersionLabel);
        const result = yield vscode_1.window.showErrorMessage(pythonMsg, { modal: true }, enterPython);
        if (!result) {
            throw new vscode_azureextensionui_1.UserCancelledError();
        }
        else {
            const placeHolder = localize_1.localize('pyAliasPlaceholder', 'Enter the Python alias (if its in your PATH) or the full path to your Python executable.');
            return yield extensionVariables_1.ext.ui.showInputBox({ placeHolder, validateInput: validatePythonAlias });
        }
    });
}
function createVirtualEnviornment(functionAppPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const pythonAlias = yield getPythonAlias();
        yield cpUtils_1.cpUtils.executeCommand(extensionVariables_1.ext.outputChannel, functionAppPath, pythonAlias, '-m', 'venv', exports.funcEnvName);
    });
}
exports.createVirtualEnviornment = createVirtualEnviornment;
function makeVenvDebuggable(functionAppPath) {
    return __awaiter(this, void 0, void 0, function* () {
        // install ptvsd - required for debugging in VS Code
        yield runPythonCommandInVenv(functionAppPath, 'pip install ptvsd');
    });
}
exports.makeVenvDebuggable = makeVenvDebuggable;
function runPythonCommandInVenv(folderPath, command) {
    return __awaiter(this, void 0, void 0, function* () {
        // executeCommand always uses '&&' separator even on Windows
        yield cpUtils_1.cpUtils.executeCommand(extensionVariables_1.ext.outputChannel, folderPath, convertToVenvCommand(command, process.platform, '&&'));
    });
}
exports.runPythonCommandInVenv = runPythonCommandInVenv;
//# sourceMappingURL=PythonProjectCreator.js.map