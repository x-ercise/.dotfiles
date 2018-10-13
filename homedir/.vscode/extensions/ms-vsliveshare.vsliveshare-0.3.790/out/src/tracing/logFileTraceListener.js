//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const traceSource_1 = require("./traceSource");
const fs = require("fs");
const os = require("os");
const path = require("path");
const util_1 = require("../util");
const telemetry_1 = require("../telemetry/telemetry");
const telemetryStrings_1 = require("../telemetry/telemetryStrings");
class LogFileTraceListener extends traceSource_1.TraceListener {
    constructor(processName, logDirectory) {
        super();
        this.processName = processName;
        this.logDirectory = logDirectory;
        this.canWriteLogs = true;
        this.openLogFileAsync = async (index = 0) => {
            // if 5th attempt - report to telemetry and forbit writing to local logs.
            if (index === 5) {
                this.canWriteLogs = false;
                telemetry_1.Instance.sendFault(telemetryStrings_1.TelemetryEventNames.NAME_LOGS_FILE_FAILED, telemetry_1.FaultType.Error, 'Name Log File Failed - Reached maximum number of attempts.');
                return;
            }
            const datePrefix = new Date().toISOString()
                .replace(/T/, '_')
                .replace(/:|-/g, '')
                .replace(/\..+/, '');
            // Ensure a unique file name, in case another log session started around the same time.
            const indexFileName = path.join(this.logDirectory, `${datePrefix}_${Date.now()}${index}_${this.processName}.log`);
            try {
                const fileDescriptior = await util_1.openFileAsync(indexFileName, 'ax'); // Append, fail if exists
                this.fileDescriptior = fileDescriptior;
                this.fileName = indexFileName;
            }
            catch (err) {
                if (err.code === 'EEXIST') {
                    // try the nex index
                    await this.openLogFileAsync(index + 1);
                }
                else {
                    this.canWriteLogs = false;
                    telemetry_1.Instance.sendFault(telemetryStrings_1.TelemetryEventNames.OPEN_LOGS_FAILED, telemetry_1.FaultType.Error, `Name Log File Failed. ${err.message}`, err.stack);
                }
            }
            this.writePromise = Promise.resolve();
        };
        if (!this.logDirectory) {
            this.logDirectory = LogFileTraceListener.defaultLogDirectory;
        }
    }
    static get defaultLogDirectory() {
        return path.join(os.tmpdir(), 'VSFeedbackVSRTCLogs');
    }
    get logFileName() {
        return this.fileName;
    }
    /**
     * Opens the log file. Await this method before using the trace listener.
     */
    async openAsync() {
        await new Promise((resolve, reject) => {
            fs.mkdir(this.logDirectory, (err) => {
                resolve();
            });
        });
        await this.openLogFileAsync();
    }
    writeLine(line) {
        // Agent messages that are traced with writeLine() are already
        // logged to a separate file by the agent process.
    }
    writeEvent(source, eventType, id, message) {
        if (this.canWriteLogs === false) {
            return;
        }
        const line = traceSource_1.TraceFormat.formatEvent(new Date(), source, eventType, id, message);
        this.writePromise = this.writePromise.then(() => {
            return new Promise((resolve, reject) => {
                fs.write(this.fileDescriptior, line + os.EOL, (err) => {
                    if (err) {
                        this.canWriteLogs = false;
                        // do not reject if error, but log the event to telemetry
                        telemetry_1.Instance.sendFault(telemetryStrings_1.TelemetryEventNames.WRITE_LOGS_FAILED, telemetry_1.FaultType.Error, err.message, err.stack);
                    }
                    resolve();
                });
            });
        });
    }
}
exports.LogFileTraceListener = LogFileTraceListener;

//# sourceMappingURL=logFileTraceListener.js.map
