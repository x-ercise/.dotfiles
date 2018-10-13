//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const url = require("url");
class MementoConfig {
    static get Instance() {
        if (!MementoConfig.singleton) {
            MementoConfig.singleton = new MementoConfig();
        }
        return MementoConfig.singleton;
    }
    async initAsync(context) {
        this.globalState = context.globalState;
    }
    get(key) {
        return this.globalState.get(key);
    }
    async save(key, value) {
        this.globalState.update(key, value);
    }
    getUri(keyString) {
        let value = this.get(keyString);
        if (!value) {
            return null;
        }
        try {
            return url.parse(value);
        }
        catch (e) {
            return null;
        }
    }
}
const mementoConfigInstance = MementoConfig.Instance;
exports.MementoConfig = mementoConfigInstance;

//# sourceMappingURL=mementoConfig.js.map
