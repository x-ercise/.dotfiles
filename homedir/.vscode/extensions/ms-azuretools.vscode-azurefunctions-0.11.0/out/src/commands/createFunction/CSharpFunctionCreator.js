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
const fse = require("fs-extra");
const path = require("path");
// tslint:disable-next-line:no-require-imports
const XRegExp = require("xregexp");
const localize_1 = require("../../localize");
const executeDotnetTemplateCommand_1 = require("../../templates/executeDotnetTemplateCommand");
const cpUtils_1 = require("../../utils/cpUtils");
const dotnetUtils_1 = require("../../utils/dotnetUtils");
const fsUtil = require("../../utils/fs");
const FunctionCreatorBase_1 = require("./FunctionCreatorBase");
class CSharpFunctionCreator extends FunctionCreatorBase_1.FunctionCreatorBase {
    constructor(functionAppPath, template) {
        super(functionAppPath, template);
    }
    promptForSettings(ui, functionName, functionSettings) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!functionName) {
                const defaultFunctionName = yield fsUtil.getUniqueFsPath(this._functionAppPath, this._template.defaultFunctionName, '.cs');
                this._functionName = yield ui.showInputBox({
                    placeHolder: localize_1.localize('azFunc.funcNamePlaceholder', 'Function name'),
                    prompt: localize_1.localize('azFunc.funcNamePrompt', 'Provide a function name'),
                    validateInput: (s) => this.validateTemplateName(s),
                    value: defaultFunctionName || this._template.defaultFunctionName
                });
            }
            else {
                this._functionName = functionName;
            }
            if (functionSettings.namespace !== undefined) {
                this._namespace = functionSettings.namespace;
            }
            else {
                this._namespace = yield ui.showInputBox({
                    placeHolder: localize_1.localize('azFunc.namespacePlaceHolder', 'Namespace'),
                    prompt: localize_1.localize('azFunc.namespacePrompt', 'Provide a namespace'),
                    validateInput: validateCSharpNamespace,
                    value: 'Company.Function'
                });
            }
        });
    }
    createFunction(userSettings, runtime) {
        return __awaiter(this, void 0, void 0, function* () {
            yield dotnetUtils_1.dotnetUtils.validateDotnetInstalled();
            const args = [];
            args.push('--arg:name');
            args.push(cpUtils_1.cpUtils.wrapArgInQuotes(this._functionName));
            args.push('--arg:namespace');
            args.push(cpUtils_1.cpUtils.wrapArgInQuotes(this._namespace));
            for (const key of Object.keys(userSettings)) {
                args.push(`--arg:${key}`);
                args.push(cpUtils_1.cpUtils.wrapArgInQuotes(userSettings[key]));
            }
            yield executeDotnetTemplateCommand_1.executeDotnetTemplateCommand(runtime, this._functionAppPath, 'create', '--identity', this._template.id, ...args);
            return path.join(this._functionAppPath, `${this._functionName}.cs`);
        });
    }
    validateTemplateName(name) {
        if (!name) {
            return localize_1.localize('azFunc.emptyTemplateNameError', 'The template name cannot be empty.');
        }
        else if (fse.existsSync(path.join(this._functionAppPath, `${name}.cs`))) {
            return localize_1.localize('azFunc.existingCSFile', 'A CSharp file with the name \'{0}\' already exists.', name);
        }
        else if (!this._functionNameRegex.test(name)) {
            return localize_1.localize('azFunc.functionNameInvalidError', 'Function name must start with a letter and can contain letters, digits, \'_\' and \'-\'');
        }
        else {
            return undefined;
        }
    }
}
exports.CSharpFunctionCreator = CSharpFunctionCreator;
// Identifier specification: https://github.com/dotnet/csharplang/blob/master/spec/lexical-structure.md#identifiers
const formattingCharacter = '\\p{Cf}';
const connectingCharacter = '\\p{Pc}';
const decimalDigitCharacter = '\\p{Nd}';
const combiningCharacter = '\\p{Mn}|\\p{Mc}';
const letterCharacter = '\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}';
const identifierPartCharacter = `${letterCharacter}|${decimalDigitCharacter}|${connectingCharacter}|${combiningCharacter}|${formattingCharacter}`;
const identifierStartCharacter = `(${letterCharacter}|_)`;
const identifierOrKeyword = `${identifierStartCharacter}(${identifierPartCharacter})*`;
const identifierRegex = XRegExp(`^${identifierOrKeyword}$`);
// Keywords: https://github.com/dotnet/csharplang/blob/master/spec/lexical-structure.md#keywords
const keywords = ['abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char', 'checked', 'class', 'const', 'continue', 'decimal', 'default', 'delegate', 'do', 'double', 'else', 'enum', 'event', 'explicit', 'extern', 'false', 'finally', 'fixed', 'float', 'for', 'foreach', 'goto', 'if', 'implicit', 'in', 'int', 'interface', 'internal', 'is', 'lock', 'long', 'namespace', 'new', 'null', 'object', 'operator', 'out', 'override', 'params', 'private', 'protected', 'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed', 'short', 'sizeof', 'stackalloc', 'static', 'string', 'struct', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe', 'ushort', 'using', 'virtual', 'void', 'volatile', 'while'];
function validateCSharpNamespace(value) {
    if (!value) {
        return localize_1.localize('azFunc.cSharpEmptyTemplateNameError', 'The template name cannot be empty.');
    }
    // Namespace specification: https://github.com/dotnet/csharplang/blob/master/spec/namespaces.md#namespace-declarations
    const identifiers = value.split('.');
    for (const identifier of identifiers) {
        if (identifier === '') {
            return localize_1.localize('azFunc.cSharpExtraPeriod', 'Leading or trailing "." character is not allowed.');
        }
        else if (!identifierRegex.test(identifier)) {
            return localize_1.localize('azFunc.cSharpInvalidCharacters', 'The identifier "{0}" contains invalid characters.', identifier);
        }
        else if (keywords.find((s) => s === identifier.toLowerCase()) !== undefined) {
            return localize_1.localize('azFunc.cSharpKeywordWarning', 'The identifier "{0}" is a reserved keyword.', identifier);
        }
    }
    return undefined;
}
exports.validateCSharpNamespace = validateCSharpNamespace;
//# sourceMappingURL=CSharpFunctionCreator.js.map