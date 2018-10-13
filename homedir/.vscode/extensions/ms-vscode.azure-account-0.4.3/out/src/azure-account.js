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
const adal = require('adal-node');
const MemoryCache = adal.MemoryCache;
const AuthenticationContext = adal.AuthenticationContext;
const CacheDriver = require('adal-node/lib/cache-driver');
const createLogContext = require('adal-node/lib/log').createLogContext;
const ms_rest_azure_1 = require("ms-rest-azure");
const azure_arm_resource_1 = require("azure-arm-resource");
const opn = require("opn");
const copypaste = require("copy-paste");
const nls = require("vscode-nls");
const cp = require("child_process");
const vscode_1 = require("vscode");
const cloudConsole_1 = require("./cloudConsole");
const localize = nls.loadMessageBundle();
const keytar = getNodeModule('keytar');
function getNodeModule(moduleName) {
    try {
        return require(`${vscode_1.env.appRoot}/node_modules.asar/${moduleName}`);
    }
    catch (err) {
        // Not in ASAR.
    }
    try {
        return require(`${vscode_1.env.appRoot}/node_modules/${moduleName}`);
    }
    catch (err) {
        // Not available.
    }
    return undefined;
}
//List of environment names for user to choose from
function getEnvironmentList() {
    var list;
    list = ["Azure", "Azure US Government", "Azure China", "Azure Germany"];
    return list;
}
//Returns AzureEnvironment that use has chosen
function getEnvironment(name) {
    var environmentList = {};
    environmentList["Azure"] = ms_rest_azure_1.AzureEnvironment.Azure;
    environmentList["Azure US Government"] = ms_rest_azure_1.AzureEnvironment.AzureUSGovernment;
    environmentList["Azure China"] = ms_rest_azure_1.AzureEnvironment.AzureChina;
    environmentList["Azure Germany"] = ms_rest_azure_1.AzureEnvironment.AzureGermanCloud;
    if (name) {
        return environmentList[name];
    }
    else {
        return environmentList["Azure"];
    }
}
const logVerbose = false;
const commonTenantId = 'common';
const clientId = 'aebc6443-996d-45c2-90f0-388ff96faa56'; // VSC: 'aebc6443-996d-45c2-90f0-388ff96faa56'
const validateAuthority = true;
const credentialsAccount = 'Refresh Token';
class AzureLoginError extends Error {
    constructor(message, reason) {
        super(message);
        this.reason = reason;
    }
}
class ProxyTokenCache {
    constructor(target) {
        this.target = target;
        this.init = new Promise(resolve => {
            this.initEnd = resolve;
        });
    }
    remove(entries, callback) {
        this.target.remove(entries, callback);
    }
    add(entries, callback) {
        this.target.add(entries, callback);
    }
    find(query, callback) {
        this.init.then(() => {
            this.target.find(query, callback);
        });
    }
}
class AzureLoginHelper {
    constructor(context, reporter) {
        this.context = context;
        this.reporter = reporter;
        this.onStatusChanged = new vscode_1.EventEmitter();
        this.onSessionsChanged = new vscode_1.EventEmitter();
        this.subscriptions = Promise.resolve([]);
        this.onSubscriptionsChanged = new vscode_1.EventEmitter();
        this.filters = Promise.resolve([]);
        this.onFiltersChanged = new vscode_1.EventEmitter();
        this.tokenCache = new MemoryCache();
        this.delayedCache = new ProxyTokenCache(this.tokenCache);
        this.oldResourceFilter = '';
        this.api = {
            status: 'Initializing',
            onStatusChanged: this.onStatusChanged.event,
            waitForLogin: () => this.waitForLogin(),
            sessions: [],
            onSessionsChanged: this.onSessionsChanged.event,
            subscriptions: [],
            onSubscriptionsChanged: this.onSubscriptionsChanged.event,
            waitForSubscriptions: () => this.waitForSubscriptions(),
            filters: [],
            onFiltersChanged: this.onFiltersChanged.event,
            waitForFilters: () => this.waitForFilters(),
            createCloudShell: os => cloudConsole_1.createCloudConsole(this.api, this.reporter, os)
        };
        const subscriptions = context.subscriptions;
        subscriptions.push(vscode_1.commands.registerCommand('azure-account.login', () => this.login().catch(console.error)));
        subscriptions.push(vscode_1.commands.registerCommand('azure-account.logout', () => this.logout().catch(console.error)));
        subscriptions.push(vscode_1.commands.registerCommand('azure-account.askForLogin', () => this.askForLogin().catch(console.error)));
        subscriptions.push(vscode_1.commands.registerCommand('azure-account.selectSubscriptions', () => this.selectSubscriptions().catch(console.error)));
        subscriptions.push(this.api.onSessionsChanged(() => this.updateSubscriptions().catch(console.error)));
        subscriptions.push(this.api.onSubscriptionsChanged(() => this.updateFilters()));
        subscriptions.push(vscode_1.workspace.onDidChangeConfiguration(() => this.updateFilters(true)));
        this.initialize()
            .catch(console.error);
        if (logVerbose) {
            const outputChannel = vscode_1.window.createOutputChannel('Azure Account');
            subscriptions.push(outputChannel);
            this.enableLogging(outputChannel);
        }
    }
    enableLogging(channel) {
        const log = adal.Logging;
        log.setLoggingOptions({
            level: log.LOGGING_LEVEL.VERBOSE,
            log: (level, message, error) => {
                if (message) {
                    channel.appendLine(message);
                }
                if (error) {
                    channel.appendLine(error);
                }
            }
        });
    }
    login() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.beginLoggingIn();
                const environment = getSelectedEnvironment();
                const tenantId = getTenantId();
                const deviceLogin = yield deviceLogin1(environment, tenantId);
                const message = this.showDeviceCodeMessage(deviceLogin);
                const login2 = deviceLogin2(environment, tenantId, deviceLogin);
                const tokenResponse = yield Promise.race([login2, message.then(() => Promise.race([login2, timeout(3 * 60 * 1000)]))]); // 3 minutes
                const refreshToken = tokenResponse.refreshToken;
                const tokenResponses = tenantId === commonTenantId ? yield tokensFromToken(environment, tokenResponse) : [tokenResponse];
                if (keytar) {
                    yield keytar.setPassword(getCredentialsService(environment), credentialsAccount, refreshToken);
                }
                yield this.updateSessions(environment, tokenResponses);
            }
            catch (err) {
                if (err instanceof AzureLoginError && err.reason) {
                    console.error(err.reason);
                }
                throw err;
            }
            finally {
                this.updateStatus();
            }
        });
    }
    showDeviceCodeMessage(deviceLogin) {
        return __awaiter(this, void 0, void 0, function* () {
            const copyAndOpen = { title: localize('azure-account.copyAndOpen', "Copy & Open") };
            const open = { title: localize('azure-account.open', "Open") };
            const canCopy = process.platform !== 'linux' || (yield exitCode('xclip', '-version')) === 0;
            const response = yield vscode_1.window.showInformationMessage(deviceLogin.message, canCopy ? copyAndOpen : open);
            if (response === copyAndOpen) {
                copypaste.copy(deviceLogin.userCode);
                opn(deviceLogin.verificationUrl);
            }
            else if (response === open) {
                opn(deviceLogin.verificationUrl);
                yield this.showDeviceCodeMessage(deviceLogin);
            }
            else {
                return Promise.reject(null);
            }
        });
    }
    logout() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.api.waitForLogin();
            if (keytar) {
                for (const label of getEnvironmentList()) {
                    yield keytar.deletePassword(getCredentialsService(getEnvironment(label)), credentialsAccount);
                }
            }
            yield this.clearSessions();
            this.updateStatus();
        });
    }
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const timing = false;
                const start = Date.now();
                this.loadCache();
                timing && console.log(`loadCache: ${(Date.now() - start) / 1000}s`);
                const environment = getSelectedEnvironment();
                const tenantId = getTenantId();
                const refreshToken = keytar && (yield keytar.getPassword(getCredentialsService(environment), credentialsAccount));
                timing && console.log(`keytar: ${(Date.now() - start) / 1000}s`);
                if (!refreshToken) {
                    throw new AzureLoginError(localize('azure-account.refreshTokenMissing', "Not signed in"));
                }
                this.beginLoggingIn();
                const tokenResponse = yield tokenFromRefreshToken(environment, refreshToken, tenantId);
                timing && console.log(`tokenFromRefreshToken: ${(Date.now() - start) / 1000}s`);
                // For testing
                if (vscode_1.workspace.getConfiguration('azure').get('testTokenFailure')) {
                    throw new AzureLoginError(localize('azure-account.testingAquiringTokenFailed', "Testing: Acquiring token failed"));
                }
                const tokenResponses = tenantId === commonTenantId ? yield tokensFromToken(environment, tokenResponse) : [tokenResponse];
                timing && console.log(`tokensFromToken: ${(Date.now() - start) / 1000}s`);
                yield this.updateSessions(environment, tokenResponses);
                timing && console.log(`updateSessions: ${(Date.now() - start) / 1000}s`);
            }
            catch (err) {
                yield this.clearSessions(); // clear out cached data
                if (!(err instanceof AzureLoginError)) {
                    throw err;
                }
            }
            finally {
                this.updateStatus();
            }
        });
    }
    loadCache() {
        const cache = this.context.globalState.get('cache');
        if (cache) {
            this.api.status = 'LoggedIn';
            const sessions = this.initializeSessions(cache);
            const subscriptions = this.initializeSubscriptions(cache, sessions);
            this.initializeFilters(subscriptions);
        }
    }
    updateCache() {
        if (this.api.status !== 'LoggedIn') {
            this.context.globalState.update('cache', undefined);
            return;
        }
        const cache = {
            subscriptions: this.api.subscriptions.map(({ session, subscription }) => ({
                session: {
                    environment: session.environment.name,
                    userId: session.userId,
                    tenantId: session.tenantId
                },
                subscription
            }))
        };
        this.context.globalState.update('cache', cache);
    }
    beginLoggingIn() {
        if (this.api.status !== 'LoggedIn') {
            this.api.status = 'LoggingIn';
            this.onStatusChanged.fire(this.api.status);
        }
    }
    updateStatus() {
        const status = this.api.sessions.length ? 'LoggedIn' : 'LoggedOut';
        if (this.api.status !== status) {
            this.api.status = status;
            this.onStatusChanged.fire(this.api.status);
        }
    }
    initializeSessions(cache) {
        const sessions = {};
        for (const { session } of cache.subscriptions) {
            const { environment, userId, tenantId } = session;
            const key = `${environment} ${userId} ${tenantId}`;
            if (!sessions[key]) {
                sessions[key] = {
                    environment: ms_rest_azure_1.AzureEnvironment[environment],
                    userId,
                    tenantId,
                    credentials: new ms_rest_azure_1.DeviceTokenCredentials({ environment: ms_rest_azure_1.AzureEnvironment[environment], username: userId, clientId, tokenCache: this.delayedCache, domain: tenantId })
                };
                this.api.sessions.push(sessions[key]);
            }
        }
        return sessions;
    }
    updateSessions(environment, tokenResponses) {
        return __awaiter(this, void 0, void 0, function* () {
            yield clearTokenCache(this.tokenCache);
            for (const tokenResponse of tokenResponses) {
                yield addTokenToCache(environment, this.tokenCache, tokenResponse);
            }
            this.delayedCache.initEnd();
            const sessions = this.api.sessions;
            sessions.splice(0, sessions.length, ...tokenResponses.map(tokenResponse => ({
                environment,
                userId: tokenResponse.userId,
                tenantId: tokenResponse.tenantId,
                credentials: new ms_rest_azure_1.DeviceTokenCredentials({ environment: environment, username: tokenResponse.userId, clientId, tokenCache: this.delayedCache, domain: tokenResponse.tenantId })
            })));
            this.onSessionsChanged.fire();
        });
    }
    clearSessions() {
        return __awaiter(this, void 0, void 0, function* () {
            yield clearTokenCache(this.tokenCache);
            this.delayedCache.initEnd();
            const sessions = this.api.sessions;
            sessions.length = 0;
            this.onSessionsChanged.fire();
        });
    }
    waitForSubscriptions() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield this.api.waitForLogin())) {
                return false;
            }
            yield this.subscriptions;
            return true;
        });
    }
    initializeSubscriptions(cache, sessions) {
        const subscriptions = cache.subscriptions.map(({ session, subscription }) => {
            const { environment, userId, tenantId } = session;
            const key = `${environment} ${userId} ${tenantId}`;
            return {
                session: sessions[key],
                subscription
            };
        });
        this.subscriptions = Promise.resolve(subscriptions);
        this.api.subscriptions.push(...subscriptions);
        return subscriptions;
    }
    updateSubscriptions() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.api.waitForLogin();
            this.subscriptions = this.loadSubscriptions();
            this.api.subscriptions.splice(0, this.api.subscriptions.length, ...yield this.subscriptions);
            this.updateCache();
            this.onSubscriptionsChanged.fire();
        });
    }
    askForLogin() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.api.status === 'LoggedIn') {
                return;
            }
            const login = { title: localize('azure-account.login', "Sign In") };
            const result = yield vscode_1.window.showInformationMessage(localize('azure-account.loginFirst', "Not signed in, sign in first."), login);
            return result === login && vscode_1.commands.executeCommand('azure-account.login');
        });
    }
    selectSubscriptions() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield this.waitForSubscriptions())) {
                return vscode_1.commands.executeCommand('azure-account.askForLogin');
            }
            const azureConfig = vscode_1.workspace.getConfiguration('azure');
            const resourceFilter = (azureConfig.get('resourceFilter') || ['all']).slice();
            let changed = false;
            const subscriptions = this.subscriptions
                .then(list => this.asSubscriptionItems(list, resourceFilter));
            const picks = yield vscode_1.window.showQuickPick(subscriptions, { canPickMany: true, placeHolder: 'Select Subscriptions' });
            if (picks) {
                if (resourceFilter[0] === 'all') {
                    resourceFilter.splice(0, 1);
                    for (const subscription of yield subscriptions) {
                        this.addFilter(resourceFilter, subscription);
                    }
                }
                for (const subscription of yield subscriptions) {
                    if (subscription.picked !== (picks.indexOf(subscription) !== -1)) {
                        changed = true;
                        if (subscription.picked) {
                            this.removeFilter(resourceFilter, subscription);
                        }
                        else {
                            this.addFilter(resourceFilter, subscription);
                        }
                    }
                }
            }
            if (changed) {
                yield this.updateConfiguration(azureConfig, resourceFilter);
            }
        });
    }
    addFilter(resourceFilter, item) {
        const { session, subscription } = item.subscription;
        resourceFilter.push(`${session.tenantId}/${subscription.subscriptionId}`);
        item.picked = true;
    }
    removeFilter(resourceFilter, item) {
        const { session, subscription } = item.subscription;
        const remove = resourceFilter.indexOf(`${session.tenantId}/${subscription.subscriptionId}`);
        resourceFilter.splice(remove, 1);
        item.picked = false;
    }
    loadSubscriptions() {
        return __awaiter(this, void 0, void 0, function* () {
            const lists = yield Promise.all(this.api.sessions.map(session => {
                const credentials = session.credentials;
                const client = new azure_arm_resource_1.SubscriptionClient(credentials, session.environment.resourceManagerEndpointUrl);
                return listAll(client.subscriptions, client.subscriptions.list())
                    .then(list => list.map(subscription => ({
                    session,
                    subscription,
                })));
            }));
            const subscriptions = [].concat(...lists);
            subscriptions.sort((a, b) => a.subscription.displayName.localeCompare(b.subscription.displayName));
            return subscriptions;
        });
    }
    asSubscriptionItems(subscriptions, resourceFilter) {
        return subscriptions.map(subscription => {
            const picked = resourceFilter.indexOf(`${subscription.session.tenantId}/${subscription.subscription.subscriptionId}`) !== -1 || resourceFilter[0] === 'all';
            return {
                type: 'item',
                label: subscription.subscription.displayName,
                description: subscription.subscription.subscriptionId,
                subscription,
                picked,
            };
        });
    }
    updateConfiguration(azureConfig, resourceFilter) {
        return __awaiter(this, void 0, void 0, function* () {
            const resourceFilterConfig = azureConfig.inspect('resourceFilter');
            let target = vscode_1.ConfigurationTarget.Global;
            if (resourceFilterConfig) {
                if (resourceFilterConfig.workspaceFolderValue) {
                    target = vscode_1.ConfigurationTarget.WorkspaceFolder;
                }
                else if (resourceFilterConfig.workspaceValue) {
                    target = vscode_1.ConfigurationTarget.Workspace;
                }
                else if (resourceFilterConfig.globalValue) {
                    target = vscode_1.ConfigurationTarget.Global;
                }
            }
            yield azureConfig.update('resourceFilter', resourceFilter[0] !== 'all' ? resourceFilter : undefined, target);
        });
    }
    initializeFilters(subscriptions) {
        const azureConfig = vscode_1.workspace.getConfiguration('azure');
        const resourceFilter = azureConfig.get('resourceFilter');
        this.oldResourceFilter = JSON.stringify(resourceFilter);
        const newFilters = this.newFilters(subscriptions, resourceFilter);
        this.filters = Promise.resolve(newFilters);
        this.api.filters.push(...newFilters);
    }
    updateFilters(configChange = false) {
        const azureConfig = vscode_1.workspace.getConfiguration('azure');
        const resourceFilter = azureConfig.get('resourceFilter');
        if (configChange && JSON.stringify(resourceFilter) === this.oldResourceFilter) {
            return;
        }
        this.filters = (() => __awaiter(this, void 0, void 0, function* () {
            yield this.waitForSubscriptions();
            const subscriptions = yield this.subscriptions;
            this.oldResourceFilter = JSON.stringify(resourceFilter);
            const newFilters = this.newFilters(subscriptions, resourceFilter);
            this.api.filters.splice(0, this.api.filters.length, ...newFilters);
            this.onFiltersChanged.fire();
            return this.api.filters;
        }))();
    }
    newFilters(subscriptions, resourceFilter) {
        if (resourceFilter && !Array.isArray(resourceFilter)) {
            resourceFilter = [];
        }
        const filters = resourceFilter && resourceFilter.reduce((f, s) => {
            if (typeof s === 'string') {
                f[s] = true;
            }
            return f;
        }, {});
        return filters ? subscriptions.filter(s => filters[`${s.session.tenantId}/${s.subscription.subscriptionId}`]) : subscriptions;
    }
    waitForLogin() {
        return __awaiter(this, void 0, void 0, function* () {
            switch (this.api.status) {
                case 'LoggedIn':
                    return true;
                case 'LoggedOut':
                    return false;
                case 'Initializing':
                case 'LoggingIn':
                    return new Promise(resolve => {
                        const subscription = this.api.onStatusChanged(() => {
                            subscription.dispose();
                            resolve(this.waitForLogin());
                        });
                    });
                default:
                    const status = this.api.status;
                    throw new Error(`Unexpected status '${status}'`);
            }
        });
    }
    waitForFilters() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield this.waitForSubscriptions())) {
                return false;
            }
            yield this.filters;
            return true;
        });
    }
}
exports.AzureLoginHelper = AzureLoginHelper;
function getCredentialsService(environment) {
    return environment.name === 'Azure' ? 'VSCode Public Azure' : `VSCode ${environment.name}`;
}
function getSelectedEnvironment() {
    const envConfig = vscode_1.workspace.getConfiguration('azure');
    const envSetting = envConfig.get('environment') || 'Azure';
    return getEnvironment(envSetting);
}
function getTenantId() {
    const envConfig = vscode_1.workspace.getConfiguration('azure');
    return envConfig.get('tenant') || commonTenantId;
}
function deviceLogin1(environment, tenantId) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const cache = new MemoryCache();
            const context = new AuthenticationContext(`${environment.activeDirectoryEndpointUrl}${tenantId}`, validateAuthority, cache);
            context.acquireUserCode(environment.activeDirectoryResourceId, clientId, 'en-us', function (err, response) {
                if (err) {
                    reject(new AzureLoginError(localize('azure-account.userCodeFailed', "Acquiring user code failed"), err));
                }
                else {
                    resolve(response);
                }
            });
        });
    });
}
function deviceLogin2(environment, tenantId, deviceLogin) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const tokenCache = new MemoryCache();
            const context = new AuthenticationContext(`${environment.activeDirectoryEndpointUrl}${tenantId}`, validateAuthority, tokenCache);
            context.acquireTokenWithDeviceCode(`${environment.managementEndpointUrl}`, clientId, deviceLogin, function (err, tokenResponse) {
                if (err) {
                    reject(new AzureLoginError(localize('azure-account.tokenFailed', "Acquiring token with device code failed"), err));
                }
                else {
                    resolve(tokenResponse);
                }
            });
        });
    });
}
function tokenFromRefreshToken(environment, refreshToken, tenantId, resource = null) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const tokenCache = new MemoryCache();
            const context = new AuthenticationContext(`${environment.activeDirectoryEndpointUrl}${tenantId}`, validateAuthority, tokenCache);
            context.acquireTokenWithRefreshToken(refreshToken, clientId, resource, function (err, tokenResponse) {
                if (err) {
                    reject(new AzureLoginError(localize('azure-account.tokenFromRefreshTokenFailed', "Acquiring token with refresh token failed"), err));
                }
                else {
                    resolve(tokenResponse);
                }
            });
        });
    });
}
exports.tokenFromRefreshToken = tokenFromRefreshToken;
function tokensFromToken(environment, firstTokenResponse) {
    return __awaiter(this, void 0, void 0, function* () {
        const tokenCache = new MemoryCache();
        yield addTokenToCache(environment, tokenCache, firstTokenResponse);
        const credentials = new ms_rest_azure_1.DeviceTokenCredentials({ username: firstTokenResponse.userId, clientId, tokenCache });
        const client = new azure_arm_resource_1.SubscriptionClient(credentials);
        const tenants = yield listAll(client.tenants, client.tenants.list());
        const responses = yield Promise.all(tenants.map((tenant, i) => {
            if (tenant.tenantId === firstTokenResponse.tenantId) {
                return firstTokenResponse;
            }
            return tokenFromRefreshToken(environment, firstTokenResponse.refreshToken, tenant.tenantId)
                .catch(err => {
                console.error(err instanceof AzureLoginError && err.reason ? err.reason : err);
                return null;
            });
        }));
        return responses.filter(r => r);
    });
}
function addTokenToCache(environment, tokenCache, tokenResponse) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const driver = new CacheDriver({ _logContext: createLogContext('') }, `${environment.activeDirectoryEndpointUrl}${tokenResponse.tenantId}`, tokenResponse.resource, clientId, tokenCache, (entry, resource, callback) => {
                callback(null, entry);
            });
            driver.add(tokenResponse, function (err) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    });
}
function clearTokenCache(tokenCache) {
    return __awaiter(this, void 0, void 0, function* () {
        yield new Promise((resolve, reject) => {
            tokenCache.find({}, (err, entries) => {
                if (err) {
                    reject(err);
                }
                else {
                    tokenCache.remove(entries, (err) => {
                        if (err) {
                            reject(err);
                        }
                        else {
                            resolve();
                        }
                    });
                }
            });
        });
    });
}
function listAll(client, first) {
    return __awaiter(this, void 0, void 0, function* () {
        const all = [];
        for (let list = yield first; list.length || list.nextLink; list = list.nextLink ? yield client.listNext(list.nextLink) : []) {
            all.push(...list);
        }
        return all;
    });
}
exports.listAll = listAll;
function exitCode(command, ...args) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise(resolve => {
            cp.spawn(command, args)
                .on('error', err => resolve())
                .on('exit', code => resolve(code));
        });
    });
}
function timeout(ms) {
    return new Promise((resolve, reject) => setTimeout(() => reject('timeout'), ms));
}
//# sourceMappingURL=azure-account.js.map