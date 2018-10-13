"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('fs-extra');
const path = require('path');
const js_prettify_1 = require("js-prettify");
const vscode_1 = require("vscode");
const rootPath = vscode_1.workspace.rootPath;
const packageFile = path.join(rootPath, 'package.json');
const prettyConfig = {
    indent_size: 2,
    indent_char: " ",
    indent_level: 0,
    indent_with_tabs: false,
    preserve_newlines: false,
    max_preserve_newlines: 10,
    jslint_happy: false,
    brace_style: "collapse",
    keep_array_indentation: false,
    keep_function_indentation: false,
    space_before_conditional: true,
    break_chained_methods: false,
    eval_code: false,
    unescape_strings: false,
    wrap_line_length: 0
};
function checkExists(path) {
    return fs.existsSync(path);
}
exports.checkExists = checkExists;
function formatCode(content, config = prettyConfig) {
    try {
        return js_prettify_1.js_beautify(content, prettyConfig);
    }
    catch (error) {
        return console.log(error); // lets stop it here :(
    }
}
exports.formatCode = formatCode;
function copyFile(src, dest) {
    try {
        fs.copySync(path.resolve(src), dest);
        return true;
    }
    catch (e) {
        return false;
    }
}
exports.copyFile = copyFile;
function createFile(filePath, content, __JSON__ = false) {
    try {
        if (__JSON__) {
            fs.outputJSONSync(filePath, content);
            return true;
        }
        fs.outputFileSync(filePath, content);
        return true;
    }
    catch (err) {
        return false;
    }
}
exports.createFile = createFile;
function getAppPath() {
    const appPaths = ['app', 'src'];
    const appPath = appPaths.find(f => checkExists(path.join(rootPath, f)));
    return appPath || 'app';
}
exports.getAppPath = getAppPath;
function getBundlePath() {
    const bundlePaths = ['dist', 'out', 'bundle'];
    const bundlePath = bundlePaths.find(f => checkExists(path.join(rootPath, f)));
    return bundlePath || 'dist';
}
exports.getBundlePath = getBundlePath;
function getWebpackConfig() {
    const appPath = getAppPath();
    const bundlePath = getBundlePath();
    return `
    const path = require('path');
    
    module.exports = {
      mode: 'development',
      entry: path.join(__dirname, '${appPath}', 'index'),
      output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, '${bundlePath}')
      },
      module: {
        rules: [
          {
            test: /\.jsx?$/,
            include: [
              path.resolve(__dirname, '${appPath}')
            ],
            exclude: [
              path.resolve(__dirname, 'node_modules'),
              path.resolve(__dirname, 'bower_components')
            ],
            loader: 'babel-loader',
            query: {
              presets: ['es2015']
            }
          }
        ]
      },
      resolve: {
        extensions: ['.json', '.js', '.jsx', '.css']
      },
      devtool: 'source-map',
      devServer: {
        publicPath: path.join('/${bundlePath}/')
      }
    };
  `;
}
exports.getWebpackConfig = getWebpackConfig;
function updateDevDependencies() {
    // if we dont have a package file, then no need to update.
    if (!checkExists(packageFile)) {
        return;
    }
    const devDependencies = {
        "babel-core": "^6.21.0",
        "babel-loader": "^7.1.4",
        "babel-preset-es2015": "^6.18.0",
        "webpack": "^4.8.3",
        "webpack-cli": "^2.1.4"
    };
    const newPackageInfo = Object.assign({}, require(packageFile), {
        devDependencies: devDependencies
    });
    // write JSON to package.
    try {
        fs.writeJsonSync(packageFile, newPackageInfo);
        return true;
    }
    catch (error) {
        return false;
    }
}
exports.updateDevDependencies = updateDevDependencies;
//# sourceMappingURL=utils.js.map