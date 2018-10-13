"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const semver_1 = require("semver");
const glob_1 = require("glob");
const async_1 = require("./async");
const cp = require("child_process");
function readInstalledModulesNpmls(npmBin, cwd) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const cmd = npmBin + ' ' + 'ls --depth 0 --json';
            let jsonResult = '';
            let errors = '';
            const p = cp.exec(cmd, { cwd: cwd, env: process.env });
            p.stderr.on('data', (chunk) => errors += chunk);
            p.stdout.on('data', (chunk) => jsonResult += chunk);
            p.on('close', (_code, _signal) => {
                try {
                    const resp = JSON.parse(jsonResult);
                    resolve(resp);
                }
                catch (e) {
                    reject(e);
                }
            });
        });
    });
}
exports.readInstalledModulesNpmls = readInstalledModulesNpmls;
function readInstalledModulesRaw(cwd) {
    return __awaiter(this, void 0, void 0, function* () {
        const { dependencies: prod = {}, devDependencies: dev = {} } = JSON.parse(yield async_1.readFile(path.join(cwd, 'package.json')));
        const wantedDependencies = Object.assign(Object.create(null), prod, dev);
        const reports = new Array();
        return new Promise((resolve, reject) => {
            new glob_1.Glob('node_modules/{*,@*/*}/package.json', { cwd, absolute: true })
                .on('error', reject)
                .on('match', (match) => reports.push(makeReport(match)))
                .on('end', () => resolve(merge()));
        });
        function makeReport(pkgJson) {
            return __awaiter(this, void 0, void 0, function* () {
                let invalid, extraneous;
                const json = yield async_1.readFile(pkgJson);
                const { name, version, _requiredBy: dependants } = JSON.parse(json);
                const requested = wantedDependencies[name];
                let [hasDirect, hasTransitive] = [false, false];
                for (const dep of dependants) {
                    const isDirect = dep.length === 1 || dep.charAt(0) === '#';
                    hasDirect = hasDirect || isDirect;
                    hasTransitive = hasTransitive || !isDirect;
                    if (hasTransitive && hasDirect) {
                        break;
                    }
                }
                if (hasDirect) {
                    invalid = requested && !semver_1.satisfies(version, requested);
                    extraneous = !requested && !hasTransitive;
                }
                return { [name]: { version, invalid, extraneous, missing: false } };
            });
        }
        function merge() {
            return __awaiter(this, void 0, void 0, function* () {
                const problems = [];
                const missing = Array.from(Object.keys(wantedDependencies)).reduce((all, one) => Object.assign({ [one]: { missing: true } }, all), {});
                const dependencies = (yield Promise.all(reports)).reduce((all, one) => Object.assign(all, one), missing);
                for (const name in dependencies) {
                    if (dependencies.hasOwnProperty(name)) {
                        const report = dependencies[name];
                        switch (true) {
                            case report.missing:
                                problems.push('missing:');
                                break;
                            case report.invalid:
                                problems.push('invalid:');
                                break;
                            case report.extraneous:
                                problems.push('extraneous:');
                                break;
                        }
                    }
                }
                return { problems, dependencies, invalid: false }; // TODO: When invalid???
            });
        }
    });
}
exports.readInstalledModulesRaw = readInstalledModulesRaw;
//# sourceMappingURL=readInstalledModules.js.map