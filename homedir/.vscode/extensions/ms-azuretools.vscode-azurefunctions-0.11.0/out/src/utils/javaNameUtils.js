"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const localize_1 = require("../localize");
const keywords = [
    'abstract', 'continue', 'for', 'new', 'switch',
    'assert', 'default', 'if', 'package', 'synchronized',
    'boolean', 'do', 'goto', 'private', 'this',
    'break', 'double', 'implements', 'protected', 'throw',
    'byte', 'else', 'import', 'public', 'throws',
    'case', 'enum', 'instanceof', 'return', 'transient',
    'catch', 'extends', 'int', 'short', 'try',
    'char', 'final', 'interface', 'static', 'void',
    'class', 'finally', 'long', 'strictfp', 'volatile',
    'const', 'float', 'native', 'super', 'while',
    'null', 'true', 'false'
];
const identifierRegex = /^[a-zA-Z_$][a-zA-Z\d_$]*$/;
const mavenCheckRegex = /^[a-zA-Z\d_\-\.]+$/;
function isKeyword(name) {
    return keywords.indexOf(name) > -1;
}
function isIdentifier(name) {
    return identifierRegex.test(name);
}
function validateJavaName(name) {
    if (isKeyword(name)) {
        return localize_1.localize('azFunc.JavaNameIsKeywordError', '\'{0}\' is a reserved keyword.', name);
    }
    if (!isIdentifier(name)) {
        return localize_1.localize('azFunc.JavaNameNotIdentifierError', '\'{0}\' is invalid, only allow letters, digits, \'_\', and \'$\', not begin with digit.', name);
    }
    return undefined;
}
function isValidMavenIdentifier(name) {
    return mavenCheckRegex.test(name);
}
function parseJavaClassName(name) {
    name = name.replace('-', '_');
    return `${name[0].toUpperCase()}${name.slice(1)}`;
}
exports.parseJavaClassName = parseJavaClassName;
function getFullClassName(packageName, functionName) {
    return `${packageName}.${parseJavaClassName(functionName)}`;
}
exports.getFullClassName = getFullClassName;
function validateMavenIdentifier(input) {
    if (!input) {
        return localize_1.localize('azFunc.inputEmptyError', 'The input cannot be empty.');
    }
    if (!isValidMavenIdentifier(input)) {
        return localize_1.localize('azFunc.invalidMavenIdentifierError', 'Only allow letters, digits, \'_\', \'-\' and \'.\'');
    }
    return undefined;
}
exports.validateMavenIdentifier = validateMavenIdentifier;
function validatePackageName(packageName) {
    if (!packageName) {
        return localize_1.localize('azFunc.emptyPackageNameError', 'The package name cannot be empty.');
    }
    for (const s of packageName.split('.')) {
        const checkResult = validateJavaName(s);
        if (checkResult) {
            return checkResult;
        }
    }
    return undefined;
}
exports.validatePackageName = validatePackageName;
//# sourceMappingURL=javaNameUtils.js.map