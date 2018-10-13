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
const vscode = require("vscode");
const constants_1 = require("../../constants");
const localize_1 = require("../../localize");
const fsUtil = require("../../utils/fs");
const javaNameUtils_1 = require("../../utils/javaNameUtils");
const mavenUtils_1 = require("../../utils/mavenUtils");
const IProjectCreator_1 = require("./IProjectCreator");
class JavaProjectCreator extends IProjectCreator_1.ProjectCreatorBase {
    constructor(functionAppPath, outputChannel, ui, actionContext) {
        super(functionAppPath, outputChannel, ui, actionContext.properties);
        this.templateFilter = constants_1.TemplateFilter.Verified;
        this._actionContext = actionContext;
    }
    getRuntime() {
        return __awaiter(this, void 0, void 0, function* () {
            return JavaProjectCreator.defaultRuntime;
        });
    }
    addNonVSCodeFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            yield mavenUtils_1.mavenUtils.validateMavenInstalled(this._actionContext, this.functionAppPath);
            const groupOptions = {
                placeHolder: localize_1.localize('azFunc.java.groupIdPlaceholder', 'Group ID'),
                prompt: localize_1.localize('azFunc.java.groupIdPrompt', 'Provide value for groupId'),
                validateInput: javaNameUtils_1.validateMavenIdentifier,
                value: 'com.function'
            };
            const groupId = yield this.ui.showInputBox(groupOptions);
            const artifactOptions = {
                placeHolder: localize_1.localize('azFunc.java.artifactIdPlaceholder', 'Artifact ID'),
                prompt: localize_1.localize('azFunc.java.artifactIdPrompt', 'Provide value for artifactId'),
                validateInput: javaNameUtils_1.validateMavenIdentifier,
                value: path.basename(this.functionAppPath)
            };
            const artifactId = yield this.ui.showInputBox(artifactOptions);
            const versionOptions = {
                placeHolder: localize_1.localize('azFunc.java.versionPlaceHolder', 'Version'),
                prompt: localize_1.localize('azFunc.java.versionPrompt', 'Provide value for version'),
                value: '1.0-SNAPSHOT'
            };
            const version = yield this.ui.showInputBox(versionOptions);
            const packageOptions = {
                placeHolder: localize_1.localize('azFunc.java.packagePlaceHolder', 'Package'),
                prompt: localize_1.localize('azFunc.java.packagePrompt', 'Provide value for package'),
                validateInput: javaNameUtils_1.validatePackageName,
                value: groupId
            };
            const packageName = yield this.ui.showInputBox(packageOptions);
            const appNameOptions = {
                placeHolder: localize_1.localize('azFunc.java.appNamePlaceHolder', 'App Name'),
                prompt: localize_1.localize('azFunc.java.appNamePrompt', 'Provide value for appName'),
                value: `${artifactId}-${Date.now()}`
            };
            const appName = yield this.ui.showInputBox(appNameOptions);
            const tempFolder = path.join(os.tmpdir(), fsUtil.getRandomHexString());
            yield fse.ensureDir(tempFolder);
            try {
                // Use maven command to init Java function project.
                this.outputChannel.show();
                yield mavenUtils_1.mavenUtils.executeMvnCommand(this.telemetryProperties, this.outputChannel, tempFolder, 'archetype:generate', mavenUtils_1.mavenUtils.formatMavenArg('DarchetypeGroupId', 'com.microsoft.azure'), mavenUtils_1.mavenUtils.formatMavenArg('DarchetypeArtifactId', 'azure-functions-archetype'), mavenUtils_1.mavenUtils.formatMavenArg('DgroupId', groupId), mavenUtils_1.mavenUtils.formatMavenArg('DartifactId', artifactId), mavenUtils_1.mavenUtils.formatMavenArg('Dversion', version), mavenUtils_1.mavenUtils.formatMavenArg('Dpackage', packageName), mavenUtils_1.mavenUtils.formatMavenArg('DappName', appName), '-B' // in Batch Mode
                );
                yield fsUtil.copyFolder(path.join(tempFolder, artifactId), this.functionAppPath, this.ui);
            }
            finally {
                yield fse.remove(tempFolder);
            }
            this._javaTargetPath = `target/azure-functions/${appName}/`;
        });
    }
    getTasksJson() {
        return __awaiter(this, void 0, void 0, function* () {
            let tasksJson = {
                version: '2.0.0',
                tasks: [
                    {
                        label: IProjectCreator_1.funcHostTaskLabel,
                        identifier: IProjectCreator_1.funcHostTaskId,
                        linux: {
                            command: 'sh -c "mvn clean package -B && func host start --language-worker -- \\\"-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5005\\\" --script-root \\\"%path%\\\""'
                        },
                        osx: {
                            command: 'sh -c "mvn clean package -B && func host start --language-worker -- \\\"-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5005\\\" --script-root \\\"%path%\\\""'
                        },
                        windows: {
                            command: 'powershell -command "mvn clean package -B; func host start --language-worker -- \\\"-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5005\\\" --script-root \\\"%path%\\\""'
                        },
                        type: 'shell',
                        isBackground: true,
                        presentation: {
                            reveal: 'always'
                        },
                        problemMatcher: IProjectCreator_1.funcWatchProblemMatcher
                    }
                ]
            };
            let tasksJsonString = JSON.stringify(tasksJson);
            if (!this._javaTargetPath) {
                const pomFilePath = path.join(this.functionAppPath, 'pom.xml');
                if (!(yield fse.pathExists(pomFilePath))) {
                    throw new Error(localize_1.localize('pomNotFound', 'Cannot find pom file in current project, please make sure the language setting is correct.'));
                }
                const functionAppName = yield mavenUtils_1.mavenUtils.getFunctionAppNameInPom(pomFilePath);
                if (!functionAppName) {
                    this._javaTargetPath = '<function_build_path>';
                    vscode.window.showWarningMessage(localize_1.localize('functionAppNameNotFound', 'Cannot parse the Azure Functions name from pom file, you may need to specify it in the tasks.json.'));
                }
                else {
                    this._javaTargetPath = `target/azure-functions/${functionAppName}/`;
                }
            }
            tasksJsonString = tasksJsonString.replace(/%path%/g, this._javaTargetPath);
            // tslint:disable-next-line:no-string-literal no-unsafe-any
            tasksJson = JSON.parse(tasksJsonString);
            return tasksJson;
        });
    }
    getLaunchJson() {
        return {
            version: '0.2.0',
            configurations: [
                {
                    name: localize_1.localize('azFunc.attachToJavaFunc', 'Attach to Java Functions'),
                    type: 'java',
                    request: 'attach',
                    hostName: 'localhost',
                    port: 5005,
                    preLaunchTask: IProjectCreator_1.funcHostTaskId
                }
            ]
        };
    }
    getRecommendedExtensions() {
        return super.getRecommendedExtensions().concat(['vscjava.vscode-java-debug']);
    }
}
JavaProjectCreator.defaultRuntime = constants_1.ProjectRuntime.v2;
exports.JavaProjectCreator = JavaProjectCreator;
//# sourceMappingURL=JavaProjectCreator.js.map