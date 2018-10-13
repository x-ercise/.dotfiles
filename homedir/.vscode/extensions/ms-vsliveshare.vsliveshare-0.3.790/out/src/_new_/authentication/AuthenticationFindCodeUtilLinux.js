"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process = require("child_process");
class AuthenticationFindCodeUtilLinux {
    constructor(notificationUtil, trace) {
        this.notificationUtil = notificationUtil;
        this.trace = trace;
    }
    findLoginCode(instanceId, cancellationToken) {
        const findLoginCodePromise = new Promise((resolve, reject) => {
            const findLoginCodeInterval = setInterval(() => {
                child_process.exec(`xprop -id $(xprop -root 32x '\t$0' _NET_ACTIVE_WINDOW | cut -f 2) WM_NAME`, async (err, stdout, stderr) => {
                    if (err || stderr) {
                        // xprop not supported in this Linux distro
                        this.trace.error(err ? err.message : stderr);
                        const userCode = await this.notificationUtil.showInputBox({
                            prompt: 'Sign in via the external browser, then paste the user code here.',
                            ignoreFocusOut: true,
                        }, cancellationToken);
                        return resolve(userCode);
                    }
                    const match = stdout.match(AuthenticationFindCodeUtilLinux.userCodeWithExtensionIdRegex);
                    if (match && match.length >= 3) {
                        const [_, userCode, extensionId] = match;
                        if (extensionId === instanceId) {
                            return resolve(userCode);
                        }
                    }
                });
            }, 500);
            cancellationToken.onCancellationRequested(() => {
                clearInterval(findLoginCodeInterval);
            });
        });
        return findLoginCodePromise;
    }
}
AuthenticationFindCodeUtilLinux.userCodeWithExtensionIdRegex = /\[((?:[a-z]{4}\-){3}(?:[a-z]{4}){1}):([a-z0-9-]*)\]/i;
exports.AuthenticationFindCodeUtilLinux = AuthenticationFindCodeUtilLinux;

//# sourceMappingURL=AuthenticationFindCodeUtilLinux.js.map
