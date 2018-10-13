//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
class WelcomePageUtils {
    constructor() {
        this.vsCodeApi = (typeof acquireVsCodeApi === 'function') ? acquireVsCodeApi() : null;
    }
    static get Instance() {
        if (!WelcomePageUtils.singleton) {
            WelcomePageUtils.singleton = new WelcomePageUtils();
        }
        return WelcomePageUtils.singleton;
    }
    copyLink() {
        if (!this.vsCodeApi) {
            return;
        }
        this.vsCodeApi.postMessage({
            command: 'copyUrl'
        });
    }
    shareWithYourself() {
        if (!this.vsCodeApi) {
            return;
        }
        this.vsCodeApi.postMessage({
            command: 'shareWithYourself',
            text: 'share-with-yourself-link'
        });
    }
    onClick(text) {
        if (!this.vsCodeApi) {
            return;
        }
        this.vsCodeApi.postMessage({
            command: 'onClick',
            text: text
        });
    }
}
const welcomePageUtils = WelcomePageUtils.Instance;
if (isSharing) {
    document.getElementById('js-step-share').style.display = 'none';
    document.getElementById('js-join-uri-box').oncopy = () => welcomePageUtils.copyLink();
    document.getElementById('js-join-uri-copy-button').onclick = () => welcomePageUtils.copyLink();
    document.getElementById('js-share-with-yourself-button').onclick = () => welcomePageUtils.shareWithYourself();
}
else {
    document.getElementById('js-join-uri').style.display = 'none';
    document.getElementById('js-join-uri-copy-button').style.display = 'none';
    document.getElementById('js-join-uri-box').style.display = 'none';
    document.getElementById('js-share-with-yourself-button').style.display = 'none';
}
if (!isWebView) {
    document.getElementById('js-join-uri-copy-button').style.display = 'none';
    document.getElementById('js-share-with-yourself-button').style.display = 'none';
}
else {
    // on click telemetry handlers
    for (let i = 0; i < document.links.length; i++) {
        const link = document.links[i];
        link.onclick = () => welcomePageUtils.onClick(link.id);
    }
}

//# sourceMappingURL=welcomePageMain.js.map
