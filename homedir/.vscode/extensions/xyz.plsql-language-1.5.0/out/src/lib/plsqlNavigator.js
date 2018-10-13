"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const plsqlParser_1 = require("./plsqlParser");
const path = require("path");
const fs = require("fs");
class PlSqlNavigator {
    static goto(cursorInfos, lineOffset, parserRoot, pkgGetName_cb, search_cb, findSpec) {
        return new Promise((resolve, reject) => {
            let cursorSymbol, rootSymbol, rootSymbol2, navigateSymbol, navigateSymbol2, isDeclaration, packageName;
            // Declaration
            if ( /*!cursorInfos.previousDot &&*/this.isPackageDeclaration(cursorInfos.previousWord)) {
                isDeclaration = true;
                cursorSymbol = plsqlParser_1.default.findSymbolByNameOffset(parserRoot.symbols, cursorInfos.currentWord, lineOffset);
                if (cursorSymbol && cursorSymbol.parent) {
                    if (findSpec &&
                        ((cursorSymbol.parent.kind === 1 /* packageSpec */) ||
                            [6 /* procedureSpec */, 4 /* functionSpec */].includes(cursorSymbol.kind)))
                        return resolve();
                    // switch in body (spec and body are in body)
                    if (cursorSymbol.parent.kind !== 1 /* packageSpec */) {
                        navigateSymbol = plsqlParser_1.default.findSymbolByNameKind(cursorSymbol.parent.symbols, cursorSymbol.name, plsqlParser_1.default.switchSymbolKind(cursorSymbol.kind), false);
                        if (navigateSymbol)
                            return resolve(navigateSymbol);
                    }
                    // switch body <-> spec
                    rootSymbol = plsqlParser_1.default.switchSymbol(cursorSymbol.parent);
                    if (rootSymbol && rootSymbol !== cursorSymbol.parent) {
                        navigateSymbol = plsqlParser_1.default.findSymbolByNameKind(rootSymbol.symbols, cursorSymbol.name, plsqlParser_1.default.switchSymbolKind(cursorSymbol.kind), false);
                        return resolve(navigateSymbol);
                    }
                    else if (rootSymbol === cursorSymbol.parent)
                        return resolve(); // No navigation here we are not in a package
                    else
                        // search in another file (spec && body are in separate files)
                        packageName = cursorSymbol.parent.name;
                }
                else
                    // No parent => a function or a procedure not in a package
                    return resolve();
                // Call
            }
            else {
                // Body => Body or Spec
                rootSymbol = plsqlParser_1.default.findSymbolNearOffset(parserRoot.symbols, lineOffset, false);
                if (rootSymbol && rootSymbol.kind === 1 /* packageSpec */)
                    return resolve(); // No navigation here we are in a spec
                packageName = cursorInfos.previousDot ? cursorInfos.previousWord : '';
                // Use synonyme for package
                if (pkgGetName_cb)
                    packageName = pkgGetName_cb.call(this, packageName);
                // Search in current file
                if (rootSymbol && (!packageName || (packageName.toLowerCase() === rootSymbol.name.toLowerCase()))) {
                    // Search in current body of file  (recursive for subFunctions or subProcedure)
                    navigateSymbol = plsqlParser_1.default.findSymbolByNameOffset(rootSymbol.symbols, cursorInfos.currentWord, 0, true);
                    if (navigateSymbol) {
                        if ((!findSpec && plsqlParser_1.default.isSymbolSpec(navigateSymbol)) ||
                            (findSpec && !plsqlParser_1.default.isSymbolSpec(navigateSymbol)))
                            navigateSymbol2 = plsqlParser_1.default.findSymbolByNameKind(rootSymbol.symbols, navigateSymbol.name, plsqlParser_1.default.switchSymbolKind(navigateSymbol.kind), false);
                        if (!findSpec)
                            return resolve(navigateSymbol2 || navigateSymbol);
                        else
                            navigateSymbol = navigateSymbol2 || navigateSymbol;
                    }
                    // Search in current spec (maybe a constant or type definition)
                    rootSymbol2 = plsqlParser_1.default.switchSymbol(rootSymbol);
                    if (rootSymbol2 && rootSymbol2 !== rootSymbol) {
                        navigateSymbol = plsqlParser_1.default.findSymbolByNameOffset(rootSymbol2.symbols, cursorInfos.currentWord, 0, false) || navigateSymbol;
                        if (navigateSymbol)
                            return resolve(navigateSymbol);
                    }
                    else if (!packageName && !rootSymbol2 && rootSymbol.kind === 2 /* packageBody */) {
                        // spec is in separate file
                        packageName = rootSymbol.name;
                    }
                }
            }
            // Search in external files
            const search = {
                package: packageName,
                cursorWord: cursorInfos.currentWord,
                isDeclaration: isDeclaration,
                priority: isDeclaration ? null : (findSpec ? 1 /* packageSpec */ : 2 /* packageBody */)
            };
            this.searchExternal(search, search_cb, this.gotoFile)
                .then(symbol => resolve(symbol))
                .catch(err => reject(err));
        });
    }
    static getCursorInfos(currentWord, endOffset, line) {
        let previousWord = null, previousDot = false;
        if (this.isPackageDeclaration(currentWord)) {
            const regexp = new RegExp(/(?:^\s+)?([\w\$#]+)/i);
            const found = regexp.exec(line.substr(endOffset));
            if (found) {
                previousWord = currentWord;
                currentWord = found[1];
            }
            else
                currentWord = null;
        }
        else {
            const regexp = new RegExp(`([\\w\\$#]+)(\\s+|.)${currentWord.replace(/[\$#]/g, '\\$&')}$`);
            const found = regexp.exec(line.substr(0, endOffset));
            if (found) {
                previousWord = found[1];
                previousDot = found[2] === '.';
            }
        }
        return {
            previousWord,
            currentWord,
            previousDot
        };
    }
    static complete(cursorInfos, pkgGetName_cb, search_cb) {
        return new Promise((resolve, reject) => {
            const search = {
                package: cursorInfos.previousWord,
                cursorWord: cursorInfos.currentWord,
                mode: 'complete'
            };
            this.searchExternal(search, search_cb, this.completeItem)
                .then(symbols => resolve(symbols))
                .catch(err => reject(err));
        });
    }
    static isPackageDeclaration(text) {
        return text && ['function', 'procedure'].includes(text.toLowerCase());
    }
    static searchExternal(search, search_cb, parseFn) {
        return new Promise((resolve, reject) => {
            let files;
            this.getGlobFiles(this.getGlobCmd(search, search_cb))
                .then(globFiles => {
                files = globFiles;
                return this.parseFiles(files, search, parseFn);
            })
                .then(symbol => {
                // search without packageName (because it's perhaps only the name of the schema)
                if (!symbol && search.package && search.mode !== 'complete') {
                    search.package = null;
                    return this.parseFiles(files, search, parseFn);
                }
                return symbol;
            })
                .then(symbol => {
                resolve(symbol);
            })
                .catch(err => {
                reject(err);
            });
        });
    }
    static getGlobFiles(globCmd) {
        const glob = require('glob');
        return new Promise((resolve, reject) => {
            if (!globCmd.params.cwd)
                return reject('No current directory for glob search !');
            glob(globCmd.glob, globCmd.params, (err, files) => {
                if (err)
                    return reject(err);
                return resolve(files.map(file => path.join(globCmd.params.cwd, file)));
            });
        });
    }
    static getGlobCmd(searchTexts, cb) {
        let files = [];
        if (searchTexts.package)
            files.push(searchTexts.package);
        if (searchTexts.cursorWord)
            files.push(searchTexts.cursorWord);
        let search = {
            files: files,
            glob: undefined,
            ext: ['sql', 'pls', 'pck', 'pkh', 'pks', 'pkb'],
            params: {
                nocase: true
            }
        };
        search = cb.call(this, search);
        let searchTxt;
        if (search.files.length > 1)
            searchTxt = `{${search.files.join(',')}}`;
        else
            searchTxt = search.files[0];
        search.glob = `**/*${searchTxt}*.{${search.ext.join(',')}}`;
        return search;
    }
    static parseFiles(files, searchInfos, func) {
        return new Promise((resolve, reject) => {
            const me = this;
            let latestSymbol;
            (function process(index) {
                if (index >= files.length) {
                    return resolve();
                }
                me.readFile(files[index])
                    .then(rootSymbol => {
                    const navigateSymbol = func.call(this, searchInfos, rootSymbol);
                    if (navigateSymbol.continue) {
                        latestSymbol = navigateSymbol.symbol;
                        process(index + 1);
                    }
                    else
                        resolve(navigateSymbol.symbol || latestSymbol);
                })
                    .catch(errParse => {
                    // an error with this file
                    reject(errParse);
                });
            })(0);
        });
    }
    static completeItem(searchInfos, rootSymbol) {
        // TODO: return current package body private func/proc/spec
        const parentSymbol = plsqlParser_1.default.findSymbolByNameKind(rootSymbol.symbols, searchInfos.package, [1 /* packageSpec */], false);
        if (parentSymbol)
            return { symbol: parentSymbol.symbols };
        else
            return { continue: true }; // return null for continue search with next file
    }
    static gotoFile(searchInfos, rootSymbol) {
        let parentSymbol, navigateSymbol, symbols;
        if (searchInfos.package) {
            parentSymbol = plsqlParser_1.default.findSymbolByNameKind(rootSymbol.symbols, searchInfos.package, [1 /* packageSpec */, 2 /* packageBody */], false);
            if (parentSymbol)
                symbols = parentSymbol.symbols;
            // else continue search, package is not in this file
        }
        else
            symbols = rootSymbol.symbols;
        if (symbols) {
            navigateSymbol = plsqlParser_1.default.findSymbolByNameOffset(symbols, searchInfos.cursorWord, 0, false);
            if (navigateSymbol) {
                if (navigateSymbol.parent &&
                    ((searchInfos.priority === 1 /* packageSpec */ && navigateSymbol.parent.kind === 2 /* packageBody */ &&
                        [3 /* function */, 5 /* procedure */].includes(navigateSymbol.kind)) ||
                        (searchInfos.priority === 2 /* packageBody */ && navigateSymbol.parent.kind === 1 /* packageSpec */ &&
                            [4 /* functionSpec */, 6 /* procedureSpec */].includes(navigateSymbol.kind)))) {
                    parentSymbol = plsqlParser_1.default.switchSymbol(navigateSymbol.parent);
                    if (parentSymbol && parentSymbol !== navigateSymbol.parent)
                        return { symbol: plsqlParser_1.default.findSymbolByNameOffset(parentSymbol.symbols, searchInfos.cursorWord, 0, false) || navigateSymbol };
                    else
                        return { symbol: navigateSymbol, continue: true }; // continue search, body and spec are in a different file
                }
                else
                    return { symbol: navigateSymbol };
            }
        }
        return { continue: true };
    }
    static readFile(file) {
        return new Promise((resolve, reject) => {
            fs.readFile(file, (err, data) => {
                if (err)
                    return reject(err);
                return resolve(plsqlParser_1.default.parseFile(file, data.toString()));
            });
        });
    }
}
exports.PlSqlNavigator = PlSqlNavigator;
//# sourceMappingURL=plsqlNavigator.js.map