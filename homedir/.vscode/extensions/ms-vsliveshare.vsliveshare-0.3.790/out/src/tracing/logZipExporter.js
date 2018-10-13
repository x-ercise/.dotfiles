//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fse = require("fs-extra");
const util_1 = require("../util");
const zip = require('yazl');
const logFileExtensions = [
    '.log',
    '.blog',
];
class LogZipExporter {
    static async createLogZipFileAsync(zipFilePath, directoryPath) {
        const logFiles = (await util_1.findFilesAsync(directoryPath, directoryPath, file => logFileExtensions.indexOf(path.extname(file)) >= 0))
            .sort();
        const zipFile = new zip.ZipFile();
        zipFile.outputStream.pipe(fse.createWriteStream(zipFilePath));
        logFiles.forEach((logFile) => {
            zipFile.addFile(path.join(directoryPath, logFile), logFile);
        });
        zipFile.end();
    }
}
exports.LogZipExporter = LogZipExporter;

//# sourceMappingURL=logZipExporter.js.map
