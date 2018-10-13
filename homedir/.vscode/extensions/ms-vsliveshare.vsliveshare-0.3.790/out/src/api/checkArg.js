//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
function checkArg(value, name, type) {
    if (!value) {
        throw new Error('Argument \'' + name + '\' is required.');
    }
    else if (type) {
        if (type === 'array') {
            if (!Array.isArray(value)) {
                throw new Error('Argument \'' + name + '\' must be an array.');
            }
        }
        else if (type === 'uri') {
            if (!(value instanceof vscode_1.Uri)) {
                throw new Error('Argument \'' + name + '\' must be a Uri object.');
            }
        }
        else if (type === 'object' && Array.isArray(value)) {
            throw new Error('Argument \'' + name + '\' must be a a non-array object.');
        }
        else if (typeof value !== type) {
            throw new Error('Argument \'' + name + '\' must be type \'' + type + '\'.');
        }
    }
}
exports.default = checkArg;

//# sourceMappingURL=checkArg.js.map
