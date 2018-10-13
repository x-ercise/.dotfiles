"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const msRest = require("ms-rest");
const msRestAzure = require("ms-rest-azure");
// Copied and adapted from the Azue SDK.
class TenantDetailsClient extends msRestAzure.AzureServiceClient {
    constructor(credentials, tenantID, baseUri = 'https://graph.windows.net') {
        super(credentials, {});
        this.credentials = credentials;
        this.tenantID = tenantID;
        this.baseUri = baseUri;
        this.acceptLanguage = 'en-US';
        this.longRunningOperationRetryTimeout = 30;
        this.generateClientRequestId = true;
        this.details = new Details(this);
        let packageInfo = this.getPackageJsonInfo(__dirname);
        this.addUserAgentInfo(`${packageInfo.name}/${packageInfo.version}`);
        msRest.addSerializationMixin(this);
    }
}
exports.TenantDetailsClient = TenantDetailsClient;
class Details {
    constructor(client) {
        this.client = client;
    }
    getWithHttpOperationResponse() {
        return new Promise((resolve, reject) => {
            this._get((err, result, request, response) => {
                let httpOperationResponse = new msRest.HttpOperationResponse(request, response);
                httpOperationResponse.body = result;
                if (err) {
                    reject(err);
                }
                else {
                    resolve(httpOperationResponse);
                }
                return;
            });
        });
    }
    get() {
        return new Promise((resolve, reject) => {
            this._get((err, result, request, response) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(result);
                }
            });
        });
    }
    _get(callback) {
        let client = this.client;
        let apiVersion = '1.6';
        // Construct URL
        let baseUrl = this.client.baseUri;
        let requestUrl = baseUrl + (baseUrl.endsWith('/') ? '' : '/') + '{tenantID}/tenantDetails';
        requestUrl = requestUrl.replace('{tenantID}', encodeURIComponent(this.client.tenantID));
        requestUrl += '?' + 'api-version=' + encodeURIComponent(apiVersion);
        // Create HTTP transport objects
        let httpRequest = new msRest.WebResource();
        httpRequest.method = 'GET';
        httpRequest.headers = {};
        httpRequest.url = requestUrl;
        // Set Headers
        if (this.client.generateClientRequestId) {
            httpRequest.headers['x-ms-client-request-id'] = msRestAzure.generateUuid();
        }
        if (this.client.acceptLanguage !== undefined && this.client.acceptLanguage !== null) {
            httpRequest.headers['accept-language'] = this.client.acceptLanguage;
        }
        httpRequest.headers['Content-Type'] = 'application/json; charset=utf-8';
        httpRequest.body = null;
        // Send Request
        return client.pipeline(httpRequest, (err, response, responseBody) => {
            if (err) {
                return callback(err);
            }
            let statusCode = response.statusCode;
            if (statusCode !== 200) {
                let error = new Error(responseBody);
                error.statusCode = response.statusCode;
                error.request = msRest.stripRequest(httpRequest);
                error.response = msRest.stripResponse(response);
                if (responseBody === '')
                    responseBody = null;
                let parsedErrorResponse;
                try {
                    parsedErrorResponse = JSON.parse(responseBody);
                    if (parsedErrorResponse) {
                        let internalError = null;
                        if (parsedErrorResponse.error)
                            internalError = parsedErrorResponse.error;
                        error.code = internalError ? internalError.code : parsedErrorResponse.code;
                        error.message = internalError ? internalError.message : parsedErrorResponse.message;
                    }
                    if (parsedErrorResponse !== null && parsedErrorResponse !== undefined) {
                        error.body = parsedErrorResponse;
                    }
                }
                catch (defaultError) {
                    error.message = `Error "${defaultError.message}" occurred in deserializing the responseBody ` +
                        `- "${responseBody}" for the default response.`;
                    return callback(error);
                }
                return callback(error);
            }
            // Create Result
            let result = null;
            if (responseBody === '')
                responseBody = null;
            // Deserialize Response
            if (statusCode === 200) {
                let parsedResponse = null;
                try {
                    parsedResponse = JSON.parse(responseBody);
                    result = JSON.parse(responseBody);
                    if (parsedResponse !== null && parsedResponse !== undefined) {
                        result = parsedResponse;
                    }
                }
                catch (error) {
                    let deserializationError = new Error(`Error ${error} occurred in deserializing the responseBody - ${responseBody}`);
                    deserializationError.request = msRest.stripRequest(httpRequest);
                    deserializationError.response = msRest.stripResponse(response);
                    return callback(deserializationError);
                }
            }
            return callback(null, result, httpRequest, response);
        });
    }
}
//# sourceMappingURL=tenantDetailsClient.js.map