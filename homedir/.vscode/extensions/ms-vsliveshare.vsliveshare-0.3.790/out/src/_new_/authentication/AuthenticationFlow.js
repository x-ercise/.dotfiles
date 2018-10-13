"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const uuid4 = require("uuid/v4");
const session_1 = require("../../session");
const UserError_1 = require("../abstractions/UserError");
/**
 * Attempts to step through the login workflow.
 */
class AuthenticationFlow {
    constructor(authenticationProvider, sessionContext, browserUtil, electronModalUtil, trace) {
        this.authenticationProvider = authenticationProvider;
        this.sessionContext = sessionContext;
        this.browserUtil = browserUtil;
        this.electronModalUtil = electronModalUtil;
        this.trace = trace;
        this.isWarm = false;
    }
    async attemptAuthenticationCheckFlow(options, context, suppressException = false) {
        const { cancellationTokenSource } = context;
        let isAuthenticated = false;
        let error;
        try {
            isAuthenticated = await this.attemptAuthenticationCheckFlowCore(options, cancellationTokenSource && cancellationTokenSource.token);
        }
        catch (e) {
            // Store error so we don't have to duplicate the below non success
            // logic below.
            error = e;
        }
        if (!isAuthenticated) {
            if (error) {
                this.sessionContext.transition(session_1.SessionAction.SignInError);
                if (!suppressException) {
                    throw error;
                }
                else {
                    this.trace.error(`Suppressed Exception (AuthenticationFlow.attemptAuthenticationCheckFlow): ${error.message}`);
                }
            }
            else {
                this.sessionContext.transition(session_1.SessionAction.SignOut);
            }
        }
        else {
            this.sessionContext.transition(session_1.SessionAction.SignInSuccess);
        }
        return isAuthenticated;
    }
    async attemptLoginFlow(options, context, suppressException = false) {
        let isSuccess = false;
        let error;
        try {
            isSuccess = await this.attemptLoginFlowCoreBrowser(options, context);
        }
        catch (e) {
            // Store error so we don't have to duplicate the below non success
            // logic below.
            error = e;
        }
        // after returning from the `attemptLoginFlowCoreBrowser` the command might be cancelled already
        const { cancellationTokenSource } = context;
        if (cancellationTokenSource && cancellationTokenSource.token.isCancellationRequested) {
            return;
        }
        // Dealing with the case where we either didn't get a profile or something
        // else in the above threw.
        if (!isSuccess) {
            this.sessionContext.transition(session_1.SessionAction.SignInError);
            const errorMessage = (error && error.message) || 'The user code is invalid or expired. Try signing in again.';
            if (!suppressException) {
                // Signal to the system that login failed
                throw error || new UserError_1.UserError(errorMessage);
            }
            else {
                this.trace.error(`Suppressed Exception (AuthenticationFlow.attemptLoginFlow): ${errorMessage}`);
            }
        }
        else {
            this.sessionContext.transition(session_1.SessionAction.SignInSuccess);
        }
    }
    async attemptAuthenticationCheckFlowCore(options, cancellationToken) {
        // Check with the auth provider what it thinks the current state is.
        const isAuthenticated = this.authenticationProvider.isAuthenticated();
        if (!this.isWarm && !isAuthenticated) {
            this.sessionContext.transition(session_1.SessionAction.AttemptSignIn);
            // Warm lets us know if we have already tried default login before.
            this.isWarm = true;
            // Attempt to login using the default/stored credentials if we can.
            return this.authenticationProvider.attemptDefaultLogin(options, cancellationToken);
        }
        return isAuthenticated;
    }
    async getLoginUri(instanceId, cancellationToken) {
        const baseLoginUri = await this.authenticationProvider.getLoginUri(cancellationToken);
        return `${baseLoginUri}?extensionId=${instanceId}`;
    }
    // sign in using electron modal window
    async attemptLoginFlowCoreElectron(options, context) {
        const { cancellationTokenSource } = context;
        const instanceId = uuid4();
        const loginUri = await this.getLoginUri(instanceId, cancellationTokenSource && cancellationTokenSource.token);
        this.sessionContext.transition(session_1.SessionAction.AwaitExternalSignIn);
        const userCode = await this.electronModalUtil.openModalAndWaitForToken(options, loginUri, context);
        this.sessionContext.transition(session_1.SessionAction.AttemptSignIn);
        // Attempt to login with the returned user code.
        return await this.authenticationProvider.attemptLogin(userCode, options, cancellationTokenSource && cancellationTokenSource.token);
    }
    // sign in using user's default browser
    async attemptLoginFlowCoreBrowser(options, context) {
        const { cancellationTokenSource } = context;
        const instanceId = uuid4();
        const loginUri = await this.getLoginUri(instanceId, cancellationTokenSource && cancellationTokenSource.token);
        // Open browser to allow user to go through oAuth flow.
        this.browserUtil.openBrowser(loginUri);
        this.sessionContext.transition(session_1.SessionAction.AwaitExternalSignIn);
        // Pause execution whilst we wait for external code to return.
        const userCode = await this.authenticationProvider.findLoginCode(instanceId, cancellationTokenSource && cancellationTokenSource.token);
        this.sessionContext.transition(session_1.SessionAction.AttemptSignIn);
        // Attempt to login with the returned user code.
        return await this.authenticationProvider.attemptLogin(userCode, options, cancellationTokenSource && cancellationTokenSource.token);
    }
}
exports.AuthenticationFlow = AuthenticationFlow;

//# sourceMappingURL=AuthenticationFlow.js.map
