"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const localize_1 = require("../localize");
var ValueType;
(function (ValueType) {
    ValueType["string"] = "string";
    ValueType["boolean"] = "boolean";
    ValueType["enum"] = "enum";
    ValueType["checkBoxList"] = "checkBoxList";
    ValueType["int"] = "int";
})(ValueType = exports.ValueType || (exports.ValueType = {}));
var ResourceType;
(function (ResourceType) {
    ResourceType["DocumentDB"] = "DocumentDB";
    ResourceType["Storage"] = "Storage";
    ResourceType["EventHub"] = "EventHub";
    ResourceType["ServiceBus"] = "ServiceBus";
})(ResourceType = exports.ResourceType || (exports.ResourceType = {}));
function getResourceTypeLabel(resourceType) {
    switch (resourceType) {
        case ResourceType.DocumentDB:
            return localize_1.localize('azFunc.DocumentDB', 'Cosmos DB Account');
        case ResourceType.Storage:
            return localize_1.localize('azFunc.Storage', 'Storage Account');
        case ResourceType.EventHub:
            return localize_1.localize('azFunc.EventHub', 'Event Hub');
        case ResourceType.ServiceBus:
            return localize_1.localize('azFunc.ServiceBus', 'Service Bus');
        default:
            return resourceType;
    }
}
exports.getResourceTypeLabel = getResourceTypeLabel;
//# sourceMappingURL=IFunctionSetting.js.map