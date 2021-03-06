'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const appModel_1 = require("./appModel");
const announcement_1 = require("./announcement");
function activate(context) {
    const appModel = new appModel_1.AppModel();
    announcement_1.checkNewAnnouncement(context.globalState);
    context.subscriptions.push(vscode_1.commands
        .registerCommand('extension.liveServer.goOnline', (fileUri) => {
        vscode_1.workspace.saveAll().then(() => {
            appModel.Golive(fileUri ? fileUri.fsPath : null);
        });
    }));
    context.subscriptions.push(vscode_1.commands
        .registerCommand('extension.liveServer.goOffline', () => {
        appModel.GoOffline();
    }));
    context.subscriptions.push(vscode_1.commands
        .registerCommand('extension.liveServer.changeWorkspace', () => {
        appModel.changeWorkspaceRoot();
    }));
    // context.subscriptions.push(window
    //     .onDidChangeActiveTextEditor(() => {
    //         if (window.activeTextEditor === undefined) return;
    //         if (workspace.rootPath === undefined && Helper.IsSupportedFile(window.activeTextEditor.document.fileName)) {
    //             StatusbarUi.Init();
    //         }
    //     })
    // );
    context.subscriptions.push(appModel);
}
exports.activate = activate;
function deactivate() {
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map