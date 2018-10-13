"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../../config");
/**
 * Provider which tracks whether the user is currently logged in or not.
 */
class AuthenticationProvider {
    constructor(authService, sessionContext, authenticationFindCodeUtil, configUtil) {
        this.authService = authService;
        this.sessionContext = sessionContext;
        this.authenticationFindCodeUtil = authenticationFindCodeUtil;
        this.configUtil = configUtil;
        this.shouldClearCache = false;
    }
    async getLoginUri(cancellationToken) {
        return this.currentLoginUri || (this.currentLoginUri = await this.authService.getLoginUriAsync());
    }
    isAuthenticated() {
        return !!this.sessionContext.userInfo;
    }
    async attemptDefaultLogin(options, cancellationToken) {
        this.shouldClearCache = false;
        this.sessionContext.userInfo = await this.authService.loginWithCachedTokenAsync({
            accountId: this.configUtil.get(config_1.Key.account),
            providerName: this.configUtil.get(config_1.Key.accountProvider),
        }, undefined, // TODO: pass options through once auth service refactored
        cancellationToken);
        return !!this.sessionContext.userInfo;
    }
    async attemptLogin(userCode, options, cancellationToken) {
        this.shouldClearCache = false;
        this.sessionContext.userInfo = await this.authService.loginAsync({ code: userCode }, {
            cache: true,
            cacheDefault: true
        }, // TODO: pass options through once auth service refactored
        cancellationToken);
        return !!this.sessionContext.userInfo;
    }
    findLoginCode(instanceId, cancellationToken) {
        return this.authenticationFindCodeUtil.findLoginCode(instanceId, cancellationToken);
    }
    async clearCache(cancellationToken) {
        this.sessionContext.userInfo = undefined;
        this.shouldClearCache = true;
        return undefined;
    }
    getCurrentUser() {
        return this.sessionContext.userInfo;
    }
}
exports.AuthenticationProvider = AuthenticationProvider;

//# sourceMappingURL=AuthenticationProvider.js.map
