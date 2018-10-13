//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const code = require("vscode");
/**
 * This type add conversion logic from LSP types to vscode types.
 * The vscode-languageclient library has some converter code but is missing these specific conversions.
 * We should contribute these back to vscode-langaugeclient once we have this fully fleshed out.
 */
function asLocation(item, p2c) {
    if (!item) {
        return undefined;
    }
    return new code.Location(p2c.asUri(item.uri), p2c.asRange(item.range));
}
exports.asLocation = asLocation;

//# sourceMappingURL=protocol2codeExtension.js.map
