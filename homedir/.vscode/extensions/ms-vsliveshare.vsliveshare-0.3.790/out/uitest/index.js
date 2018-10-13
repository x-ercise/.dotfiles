/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const path = require('path');
const Mocha = require('mocha');
const minimist = require('minimist');
const suite = 'Smoke Tests';
const [, , ...args] = process.argv;
const opts = minimist(args, {
    string: [
        'f'
    ]
});
const debugging = /--debug|--inspect/.test(process.execArgv.join(' '));
const bail = /-b\b|--bail/.test(process.argv.join(' '));
const options = {
    ui: 'bdd',
    bail,
    useColors: true,
    timeout: debugging ? 999999 : 60000,
    slow: 30000,
    grep: opts['f']
};
if (process.env.BUILD_ARTIFACTSTAGINGDIRECTORY) {
    options.reporter = 'mocha-multi-reporters';
    options.reporterOptions = {
        reporterEnabled: 'spec, mocha-junit-reporter',
        mochaJunitReporterReporterOptions: {
            testsuitesTitle: `${suite} ${process.platform}`,
            mochaFile: path.join(process.env.BUILD_ARTIFACTSTAGINGDIRECTORY, `test-results/${process.platform}-${suite.toLowerCase().replace(/[^\w]/g, '-')}-results.xml`)
        }
    };
}
const mocha = new Mocha(options);
mocha.addFile('out/uitest/uitest.js');
mocha.run(failures => process.exit(failures ? -1 : 0));

//# sourceMappingURL=index.js.map
