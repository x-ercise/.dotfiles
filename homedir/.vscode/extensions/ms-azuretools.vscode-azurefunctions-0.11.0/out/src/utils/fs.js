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
const crypto = require("crypto");
const fse = require("fs-extra");
const path = require("path");
// tslint:disable-next-line:no-require-imports
const request = require("request-promise");
const vscode_azureextensionui_1 = require("vscode-azureextensionui");
const localize_1 = require("../localize");
const javaNameUtils_1 = require("./javaNameUtils");
function writeFormattedJson(fsPath, data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield fse.writeJson(fsPath, data, { spaces: 2 });
    });
}
exports.writeFormattedJson = writeFormattedJson;
function copyFolder(fromPath, toPath, ui) {
    return __awaiter(this, void 0, void 0, function* () {
        const files = yield fse.readdir(fromPath);
        for (const file of files) {
            const originPath = path.join(fromPath, file);
            const stat = yield fse.stat(originPath);
            const targetPath = path.join(toPath, file);
            if (stat.isFile()) {
                if (yield confirmOverwriteFile(targetPath, ui)) {
                    yield fse.copy(originPath, targetPath, { overwrite: true });
                }
            }
            else if (stat.isDirectory()) {
                yield copyFolder(originPath, targetPath, ui);
            }
        }
    });
}
exports.copyFolder = copyFolder;
function confirmEditJsonFile(fsPath, editJson, ui) {
    return __awaiter(this, void 0, void 0, function* () {
        let newData;
        if (yield fse.pathExists(fsPath)) {
            try {
                newData = editJson(yield fse.readJson(fsPath));
            }
            catch (error) {
                // If we failed to parse or edit the existing file, just ask to overwrite the file completely
                if (yield confirmOverwriteFile(fsPath, ui)) {
                    newData = editJson({});
                }
                else {
                    return;
                }
            }
        }
        else {
            newData = editJson({});
        }
        yield writeFormattedJson(fsPath, newData);
    });
}
exports.confirmEditJsonFile = confirmEditJsonFile;
function confirmOverwriteFile(fsPath, ui) {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield fse.pathExists(fsPath)) {
            const result = yield ui.showWarningMessage(localize_1.localize('azFunc.fileAlreadyExists', 'File "{0}" already exists. Overwrite?', fsPath), { modal: true }, vscode_azureextensionui_1.DialogResponses.yes, vscode_azureextensionui_1.DialogResponses.no, vscode_azureextensionui_1.DialogResponses.cancel);
            if (result === vscode_azureextensionui_1.DialogResponses.yes) {
                return true;
            }
            else {
                return false;
            }
        }
        else {
            return true;
        }
    });
}
exports.confirmOverwriteFile = confirmOverwriteFile;
function getUniqueFsPath(folderPath, defaultValue, fileExtension) {
    return __awaiter(this, void 0, void 0, function* () {
        let count = 0;
        const maxCount = 1024;
        while (count < maxCount) {
            const fileName = defaultValue + (count === 0 ? '' : count.toString());
            if (!(yield fse.pathExists(path.join(folderPath, fileExtension ? `${fileName}${fileExtension}` : fileName)))) {
                return fileName;
            }
            count += 1;
        }
        return undefined;
    });
}
exports.getUniqueFsPath = getUniqueFsPath;
function getUniqueJavaFsPath(basePath, packageName, defaultValue) {
    return __awaiter(this, void 0, void 0, function* () {
        return getUniqueFsPath(path.join(basePath, 'src', 'main', 'java', ...packageName.split('.')), javaNameUtils_1.parseJavaClassName(defaultValue), '.java');
    });
}
exports.getUniqueJavaFsPath = getUniqueJavaFsPath;
function getRandomHexString(length = 10) {
    const buffer = crypto.randomBytes(Math.ceil(length / 2));
    return buffer.toString('hex').slice(0, length);
}
exports.getRandomHexString = getRandomHexString;
function isPathEqual(fsPath1, fsPath2, relativeFunc = path.relative) {
    const relativePath = relativeFunc(fsPath1, fsPath2);
    return relativePath === '';
}
exports.isPathEqual = isPathEqual;
function isSubpath(expectedParent, expectedChild, relativeFunc = path.relative) {
    const relativePath = relativeFunc(expectedParent, expectedChild);
    return relativePath !== '' && !relativePath.startsWith('..') && relativePath !== expectedChild;
}
exports.isSubpath = isSubpath;
function downloadFile(url, filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            const templateOptions = {
                method: 'GET',
                uri: url
            };
            yield fse.ensureDir(path.dirname(filePath));
            request(templateOptions, (err) => {
                // tslint:disable-next-line:strict-boolean-expressions
                if (err) {
                    reject(err);
                }
            }).pipe(fse.createWriteStream(filePath).on('finish', () => {
                resolve();
            }).on('error', (error) => {
                reject(error);
            }));
        }));
    });
}
exports.downloadFile = downloadFile;
//# sourceMappingURL=fs.js.map