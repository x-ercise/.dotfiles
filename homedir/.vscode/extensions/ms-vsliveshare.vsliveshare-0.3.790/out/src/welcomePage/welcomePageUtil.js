"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const welcomePageHTMLProvider_1 = require("./welcomePageHTMLProvider");
const config = require("../config");
const telemetry_1 = require("../telemetry/telemetry");
const telemetryStrings_1 = require("../telemetry/telemetryStrings");
const session_1 = require("../session");
const sessionTypes_1 = require("../sessionTypes");
let welcomePanel;
let welcomePageHTMLProvider;
exports.showWelcomeNotification = async () => {
    // make sure the `what's new` notification is not shown
    await config.save(config.Key.whatsNewUri, '');
    new telemetry_1.TelemetryEvent(telemetryStrings_1.TelemetryEventNames.WELCOME_PAGE_TOAST_SHOWN).send();
    const getStartedButton = { title: 'Get started' };
    const result = await vscode.window.showInformationMessage('VS Live Share installed! You can now collaboratively edit and debug with your team in real time.', getStartedButton);
    const welcomePageToastInteractionTelemetryEvent = new telemetry_1.TelemetryEvent(telemetryStrings_1.TelemetryEventNames.WELCOME_PAGE_TOAST_SHOWN_INTERACTION);
    if (result && (result.title === getStartedButton.title)) {
        // show the welcome page
        await exports.showWelcomePage(WelcomePageSource.Install);
        welcomePageToastInteractionTelemetryEvent.addProperty('openedPage', true);
    }
    else {
        welcomePageToastInteractionTelemetryEvent.addProperty('openedPage', false);
    }
    welcomePageToastInteractionTelemetryEvent.send();
};
exports.showWelcomePage = async (source) => {
    // show the welcome page
    const welcomePageShownTelemetryEvent = new telemetry_1.TelemetryEvent(telemetryStrings_1.TelemetryEventNames.WELCOME_PAGE_SHOWN);
    welcomePageShownTelemetryEvent.addProperty('source', source);
    welcomePageShownTelemetryEvent.addProperty('state', sessionTypes_1.SessionState[session_1.SessionContext.State]);
    // Check if WebviewPanel API exists
    const window = vscode.window;
    if (typeof window.createWebviewPanel === 'function') {
        welcomePageShownTelemetryEvent.addProperty('type', 'web-view');
        showWebViewWelcomePage(window);
    }
    else {
        // Otherwise fallback to TextDocumentContentProvider
        // This fallback can be removed when we no longer support
        // older versions of VSCode without WebviewPanel API
        welcomePageShownTelemetryEvent.addProperty('type', 'html-preview');
        await showHTMLPreviewWelcomePage();
    }
    welcomePageShownTelemetryEvent.send();
    // Set the welcome page displayed setting to be true only
    // after it has been displayed on the first share.
    if (source === WelcomePageSource.Sharing) {
        await config.save(config.Key.isWelcomePageDisplayed, true);
    }
};
var WelcomePageSource;
(function (WelcomePageSource) {
    WelcomePageSource["Help"] = "Help";
    WelcomePageSource["Install"] = "Install";
    WelcomePageSource["Sharing"] = "Sharing";
})(WelcomePageSource = exports.WelcomePageSource || (exports.WelcomePageSource = {}));
function getJoinUri() {
    const isShared = (session_1.SessionContext.State === sessionTypes_1.SessionState.Shared);
    return isShared && session_1.SessionContext.workspaceSessionInfo ? session_1.SessionContext.workspaceSessionInfo.joinUri : null;
}
async function showHTMLPreviewWelcomePage() {
    const previewUri = vscode.Uri.parse('vsliveshare-welcome-page://authority/vsliveshare-welcome-page');
    if (!welcomePageHTMLProvider) {
        welcomePageHTMLProvider = new welcomePageHTMLProvider_1.default();
        welcomePageHTMLProvider.joinUri = getJoinUri();
        welcomePageHTMLProvider.isWebview = false;
        vscode.workspace.registerTextDocumentContentProvider('vsliveshare-welcome-page', welcomePageHTMLProvider);
        const onSessionStateChanged = async (newState, previousState) => {
            // The session state has changed, update welcome page
            welcomePageHTMLProvider.joinUri = getJoinUri();
            welcomePageHTMLProvider.update(previewUri);
        };
        session_1.SessionContext.addListener(sessionTypes_1.SessionEvents.StateChanged, onSessionStateChanged);
    }
    await vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.One);
}
function showWebViewWelcomePage(window) {
    if (welcomePanel) {
        // Welcome panel already exists reveal it
        welcomePanel.reveal(vscode.ViewColumn.One);
        return;
    }
    if (!welcomePageHTMLProvider) {
        welcomePageHTMLProvider = new welcomePageHTMLProvider_1.default();
    }
    const extensionDir = path.resolve(__dirname, '../../');
    const welcomePagePath = path.join(extensionDir, 'src/welcomePage');
    welcomePanel = window.createWebviewPanel('vsliveshare-welcome-page', 'vsliveshare-welcome-page', vscode.ViewColumn.One, {
        enableScripts: true,
        // Restrict the webview to only load content from the `welcomePage` directory.
        localResourceRoots: [
            vscode.Uri.file(welcomePagePath)
        ]
    });
    welcomePageHTMLProvider.joinUri = getJoinUri();
    welcomePageHTMLProvider.isWebview = true;
    welcomePanel.webview.html = welcomePageHTMLProvider.provideTextDocumentContent(null);
    welcomePanel.webview.onDidReceiveMessage(function (message) {
        switch (message.command) {
            case 'copyUrl':
                new telemetry_1.TelemetryEvent(telemetryStrings_1.TelemetryEventNames.WELCOME_PAGE_COPY_CLICKED).send();
                vscode.commands.executeCommand('liveshare.collaboration.link.copy');
                return;
            case 'onClick':
                new telemetry_1.TelemetryEvent(telemetryStrings_1.TelemetryEventNames.WELCOME_PAGE_LINK_CLICKED)
                    .addProperty('link', message.text)
                    .send();
                return;
            case 'shareWithYourself':
                new telemetry_1.TelemetryEvent(telemetryStrings_1.TelemetryEventNames.WELCOME_PAGE_LINK_CLICKED)
                    .addProperty('link', message.text)
                    .send();
                // This can be removed when the old join command is deprecated
                if (!config.isVSLSTeamMember()) {
                    vscode.commands.executeCommand(`${config.get(config.Key.commandPrefix)}.join`, getJoinUri(), { newWindow: true });
                }
                else {
                    const joinPreReloadCommandOptions = { collaborationLink: getJoinUri(), newWindow: true };
                    vscode.commands.executeCommand(`${config.get(config.Key.commandPrefix)}.join`, joinPreReloadCommandOptions);
                }
                return;
            default:
                return;
        }
    });
    const onSessionStateChanged = async (newState, previousState) => {
        // The session state has changed, update welcome page
        welcomePageHTMLProvider.joinUri = getJoinUri();
        welcomePanel.webview.html = welcomePageHTMLProvider.provideTextDocumentContent(null);
    };
    session_1.SessionContext.addListener(sessionTypes_1.SessionEvents.StateChanged, onSessionStateChanged);
    welcomePanel.onDidDispose(() => {
        const welcomePageDismissedTelemetryEvent = new telemetry_1.TelemetryEvent(telemetryStrings_1.TelemetryEventNames.WELCOME_PAGE_DISMISSED);
        session_1.SessionContext.removeListener(sessionTypes_1.SessionEvents.StateChanged, onSessionStateChanged);
        welcomePanel = null;
        welcomePageDismissedTelemetryEvent.send();
    });
}

//# sourceMappingURL=welcomePageUtil.js.map
