/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const os = require("os");
const net = require("net");
const cp = require("child_process");
const vscode = require("vscode");
const semver = require("semver");
function makeRandomHexString(length) {
    let chars = ['0', '1', '2', '3', '4', '5', '6', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
    let result = '';
    for (let i = 0; i < length; i++) {
        let idx = Math.floor(chars.length * Math.random());
        result += chars[idx];
    }
    return result;
}
function generatePipeName() {
    let randomName = 'vscode-' + makeRandomHexString(20);
    if (process.platform === 'win32') {
        return '\\\\.\\pipe\\' + randomName + '-sock';
    }
    // Mac/Unix: use socket file
    return path.join(os.tmpdir(), 'CoreFxPipe_' + randomName + '.sock');
}
function generatePatchedEnv(env, stdInPipeName, stdOutPipeName, stdErrPipeName) {
    // Set the two unique pipe names and the electron flag as process env
    let newEnv = {};
    /* tslint:disable:forin */
    for (let key in env) {
        newEnv[key] = env[key];
    }
    /* tslint:enable:forin */
    /* tslint:disable:no-string-literal */
    newEnv['STDIN_PIPE_NAME'] = stdInPipeName;
    newEnv['STDOUT_PIPE_NAME'] = stdOutPipeName;
    newEnv['STDERR_PIPE_NAME'] = stdErrPipeName;
    newEnv['ELECTRON_RUN_AS_NODE'] = '1';
    // Note: we found this env variable was removed on a recent vscode version
    //newEnv['ELECTRON_NO_ASAR'] = '1';
    /* tslint:enable:no-string-literal */
    return newEnv;
}
function escapeRegExp(str) {
    return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
}
function fork(trace, modulePath, callback) {
    if (semver.lt(semver.coerce(vscode.version), '1.26.0')) {
        forkDeprecated(trace, modulePath, [], {}, callback);
        return;
    }
    // fork using electron >= 2.0
    // Note: this next section was extracted from debugAdapter.ts => startSession method when command === 'node'
    const child = cp.fork(modulePath, [], {
        execArgv: ['-e', 'delete process.env.ELECTRON_RUN_AS_NODE;require(process.argv[1])'],
        silent: true
    });
    let callbackCalled = false;
    let resolve = (result) => {
        if (callbackCalled) {
            return;
        }
        callbackCalled = true;
        callback(null, result, {
            pid: result.pid,
            stdInPipeName,
            stdOutPipeName
        });
    };
    const reject = (err) => {
        if (callbackCalled) {
            return;
        }
        callbackCalled = true;
        callback(err, null, null);
    };
    if (!child.pid) {
        reject(`Unable to launch debug adapter using:'${modulePath}'.`);
    }
    const stdInPipeName = generatePipeName();
    const stdOutPipeName = generatePipeName();
    // stdIn stream support
    const stdOutServer = net.createServer((stdOutStream) => {
        stdOutStream.on('data', (chunkStdOut) => {
            child.stdin.write(chunkStdOut);
        });
    });
    stdOutServer.listen(stdInPipeName);
    // stdOut stream support
    let stdInStream = null;
    child.stdout.on('data', (data) => {
        if (stdInStream) {
            stdInStream.write(data);
        }
    });
    const stdInServer = net.createServer((socket) => {
        stdInStream = socket;
    });
    stdInServer.listen(stdOutPipeName);
    let serverClosed = false;
    let closeServer = () => {
        if (serverClosed) {
            return;
        }
        serverClosed = true;
        process.removeListener('exit', closeServer);
        stdOutServer.close();
        stdInServer.close();
    };
    child.once('error', (err) => {
        closeServer();
        reject(err);
    });
    child.once('exit', (err) => {
        closeServer();
        reject(err);
    });
    process.on('SIGPIPE', () => {
        // macOS/linux: trying to read from a badly spawned process (ChildProcess.spawn API) now results in a SIGPIPE signal
        // which terminates the caller process if not properly handled. This SIGPIPE handler avoids this problem.
        const message = `cp.fork: SIGPIPE signal fired.`;
        trace.info(message);
        closeServer();
    });
    // invoke callback
    resolve(child);
}
exports.fork = fork;
/**
 * This function will be deprecated soon once we stop supporting vscode version < 1.26.0
 */
function forkDeprecated(trace, modulePath, args, options, callback) {
    // Generate three unique pipe names + 1 host adapter
    let stdInPipeName = generatePipeName();
    let stdOutPipeName = generatePipeName();
    let stdErrPipeName = generatePipeName();
    let stdOutHostPipeName = generatePipeName();
    let callbackCalled = false;
    let resolve = (result) => {
        if (callbackCalled) {
            return;
        }
        callbackCalled = true;
        callback(null, result, {
            pid: result.pid,
            stdInPipeName: stdInPipeName,
            stdOutPipeName: stdOutHostPipeName,
        });
    };
    let reject = (err) => {
        if (callbackCalled) {
            return;
        }
        callbackCalled = true;
        callback(err, null, null);
    };
    let newEnv = generatePatchedEnv(options.env || process.env, stdInPipeName, stdOutPipeName, stdErrPipeName);
    let childProcess;
    // Begin listening to stderr pipe
    let stdErrServer = net.createServer((stdErrStream) => {
        // From now on the childProcess.stderr is available for reading
        childProcess.stderr = stdErrStream;
    });
    stdErrServer.listen(stdErrPipeName);
    // Begin listening to stdout pipe
    let stdOutServer = net.createServer((stdOutStream) => {
        // The child process will write exactly one chunk with content `ready` when it has installed a listener to the stdin pipe
        stdOutStream.once('data', (chunk) => {
            // The child process is sending me the `ready` chunk, time to connect to the stdin pipe
            //childProcess.stdin = <any>net.connect(stdInPipeName);
            // From now on the childProcess.stdout is available for reading
            childProcess.stdout = stdOutStream;
            // since we want another process to start using the stdout we would need to create 
            // a pipe to route the response
            let hostAdapterPipeServer = net.createServer((hostAdapterStream) => {
                stdOutStream.on('data', (chunkStdOut) => {
                    hostAdapterStream.write(chunkStdOut);
                });
            });
            hostAdapterPipeServer.listen(stdOutHostPipeName);
            resolve(childProcess);
        });
    });
    stdOutServer.listen(stdOutPipeName);
    let serverClosed = false;
    let closeServer = () => {
        if (serverClosed) {
            return;
        }
        serverClosed = true;
        process.removeListener('exit', closeServer);
        stdOutServer.close();
        stdErrServer.close();
    };
    // Create the process
    let currentDir = __dirname;
    currentDir = currentDir.replace(new RegExp(escapeRegExp('\\'), 'g'), '/');
    const bootstrapperPath = currentDir + '/stdForkStart.js';
    // To launch a node.js runtime from within VS Code, we rely on the built-in node.js that Electron ships with.
    // This node.js is available by setting the ELECTRON_RUN_AS_NODE environment variable to 1 before launching
    // the electron executable (child_process.fork sets this environment variable automatically). Since the
    // environment variable is inherited to the new process, a child_process.spawn of electron will only result
    // in a plain node.js instead. This would prevent us from launching an Electron app from within an Electron
    // app (e.g. launching a node.js app for debugging from a VS Code Extension Development Host). Thus we need
    // to clear the variable by passing the code as a command line argument to node.js. Also require process.argv[1]
    // which is the location of the VS Code bootstrapper:
    // node -e 'delete process.env.ELECTRON_RUN_AS_NODE;require(process.argv[1])'
    let forkOptions = {
        silent: true,
        cwd: options.cwd,
        env: newEnv,
        execArgv: ['-e', 'delete process.env.ELECTRON_RUN_AS_NODE;require(process.argv[1])'].concat(options.execArgv || [])
    };
    childProcess = cp.fork(bootstrapperPath, [modulePath].concat(args), forkOptions);
    if (!childProcess.pid) {
        const message = `cp.fork: unable to launch module`;
        trace.error(message);
        closeServer();
        reject(new Error(message));
    }
    childProcess.once('error', (err) => {
        closeServer();
        reject(err);
    });
    childProcess.once('exit', (err) => {
        closeServer();
        reject(err);
    });
    process.on('SIGPIPE', () => {
        // macOS/linux: trying to read from a badly spawned process (ChildProcess.spawn API) now results in a SIGPIPE signal
        // which terminates the caller process if not properly handled. This SIGPIPE handler avoids this problem.
        const message = `cp.fork: SIGPIPE signal fired.`;
        trace.info(message);
        closeServer();
    });
    // On vscode exit still close server #7758
    process.once('exit', closeServer);
}

//# sourceMappingURL=stdFork.js.map
