"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const util_1 = require("../../util");
const psTree = require('ps-tree');
const child_process_1 = require("child_process");
const telemetryStrings_1 = require("../../telemetry/telemetryStrings");
const regexes_1 = require("../../electronSignIn/regexes");
/**
 * Helper functions for working with the browser.
 */
class ElectronSignInModalUtil {
    openModalAndWaitForToken(options, loginUri, context) {
        const { cancellationTokenSource, telemetryEvent, commandName } = context;
        return new Promise((resolve, reject) => {
            let killElectron;
            let isSignedIn = false;
            const cancelSignInProgressNotification = () => {
                reject(new util_1.CancellationError(`The operation was cancelled.`));
            };
            if (cancellationTokenSource && cancellationTokenSource.token.isCancellationRequested) {
                cancelSignInProgressNotification();
            }
            try {
                const command = 'electron';
                const cwd = path.join(__dirname, '../../electronSignIn/');
                const spawnEnv = JSON.parse(JSON.stringify(process.env));
                let urlChanges = '';
                // remove those env consts
                delete spawnEnv.ATOM_SHELL_INTERNAL_RUN_AS_NODE;
                delete spawnEnv.ELECTRON_RUN_AS_NODE;
                spawnEnv.VSLS_LOGIN_URI = loginUri;
                const sp = child_process_1.spawn(command, ['.'], { env: spawnEnv, cwd });
                killElectron = () => {
                    // kill the electron process and its child processes tree
                    psTree(sp.pid, function (err, children) {
                        child_process_1.spawn('kill', ['-9'].concat(children.map(function (p) { return p.PID; })));
                    });
                };
                const cancelSignInModal = () => {
                    killElectron();
                    cancelSignInProgressNotification();
                };
                if (cancellationTokenSource) {
                    cancellationTokenSource.token.onCancellationRequested(cancelSignInModal);
                }
                sp.stdout.on('data', (...data) => {
                    const str = data[0].toString();
                    if (str) {
                        const matches = str.match(regexes_1.userCodeRegex);
                        if (matches && matches[0]) {
                            const userCode = matches[0];
                            if (userCode) {
                                resolve(userCode);
                                isSignedIn = true;
                                killElectron();
                            }
                        }
                        else if (str.match(regexes_1.titleChangeRegex)) {
                            const clearURL = str.replace(regexes_1.titleChangeRegex, '');
                            urlChanges += (!urlChanges)
                                ? `${clearURL}`
                                : ` -> ${clearURL}`;
                            telemetryEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.SIGN_IN_MODAL_URL_CHANGES, urlChanges);
                        }
                    }
                });
                sp.on('close', (code) => {
                    // if `normal exit code`
                    // and `not closing because successfully signed-in`
                    // and `not closing because user cancelled the progress notification`
                    // then user closed the modal explicitly
                    if (code === 0 && !isSignedIn && !cancellationTokenSource.token.isCancellationRequested) {
                        if (telemetryEvent) {
                            telemetryEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.USER_DISMISSED_SIGN_IN_MODAL, true);
                        }
                    }
                    cancelSignInModal();
                });
                sp.on('error', reject);
            }
            catch (e) {
                killElectron();
                reject(e);
            }
        });
    }
}
exports.ElectronSignInModalUtil = ElectronSignInModalUtil;

//# sourceMappingURL=ElectronSignInModalUtil.js.map
