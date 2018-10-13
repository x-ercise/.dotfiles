"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const config = require("../../config");
const session_1 = require("../../session");
const welcomePageUtil_1 = require("../../welcomePage/welcomePageUtil");
const util_1 = require("../../util");
/**
 * Helper functions for the various prompts we show for a workspace.
 */
class WorkspacePromptsUtil {
    constructor(sessionContext, stringUtil, notificationUtil, clipboardUtil, browserUtil, workspaceAccessControlManager) {
        this.sessionContext = sessionContext;
        this.stringUtil = stringUtil;
        this.notificationUtil = notificationUtil;
        this.clipboardUtil = clipboardUtil;
        this.browserUtil = browserUtil;
        this.workspaceAccessControlManager = workspaceAccessControlManager;
    }
    async showInvitationLink(link) {
        if (!link || link === this.sessionContext.workspaceSessionInfo.joinUri) {
            const currentLink = this.sessionContext.workspaceSessionInfo.joinUri;
            await this.clipboardUtil.copyToClipboardAsync(currentLink);
            // If the welcome page has never been displayed on share show it directly.
            const isWelcomePageDisplayed = config.get(config.Key.isWelcomePageDisplayed);
            if (!isWelcomePageDisplayed) {
                await welcomePageUtil_1.showWelcomePage(welcomePageUtil_1.WelcomePageSource.Sharing);
                return;
            }
            const moreInfoButton = { id: 1, title: 'More info' };
            const copyButton = { id: 2, title: 'Copy again' };
            const toggleReadOnlyButton = { id: 3, title: session_1.SessionContext.IsReadOnly ? 'Make read/write' : 'Make read-only' };
            let buttons = [moreInfoButton, copyButton];
            if (config.featureFlags.accessControl) {
                buttons.splice(0, 0, toggleReadOnlyButton);
            }
            const result = await vscode.window.showInformationMessage('Invitation link copied to clipboard! Send it to anyone you trust or click "More info" to learn about secure sharing.', ...buttons);
            if (result && result.id === copyButton.id) {
                // Prevent this button from dismissing the notification.
                await this.showInvitationLink(currentLink);
            }
            else if (result && result.id === moreInfoButton.id) {
                await welcomePageUtil_1.showWelcomePage(welcomePageUtil_1.WelcomePageSource.Sharing);
            }
            else if (result && result.id === toggleReadOnlyButton.id) {
                await this.workspaceAccessControlManager().setReadOnly(!session_1.SessionContext.IsReadOnly);
            }
        }
        else {
            await vscode.window.showErrorMessage('This invite link has expired. Share again to generate a new link.');
        }
    }
    showSecurityInfo() {
        const securityInfoLink = 'https://aka.ms/vsls-security';
        this.browserUtil.openBrowser(securityInfoLink);
    }
    async showFirewallInformationMessage(messageId, showCancelOption) {
        const getHelp = 'Help';
        const ok = 'OK';
        let result;
        if (showCancelOption) {
            result = await this.notificationUtil.showInformationMessage(this.stringUtil.getString(messageId), { modal: util_1.ExtensionUtil.enableModalNotifications }, ok, getHelp);
        }
        else {
            let getHelpObject = { title: getHelp, isCloseAffordance: false };
            result = await this.notificationUtil.showInformationMessage(this.stringUtil.getString(messageId), { modal: util_1.ExtensionUtil.enableModalNotifications }, { title: ok, isCloseAffordance: true }, getHelpObject);
            if (result === getHelpObject) {
                result = getHelp;
            }
            else {
                result = ok;
            }
        }
        if (result === getHelp) {
            this.showFirewallHelp();
            return await this.showFirewallInformationMessage(messageId, showCancelOption);
        }
        else {
            return result === ok;
        }
    }
    showFirewallHelp() {
        const firewallHelpLink = 'https://go.microsoft.com/fwlink/?linkid=869620';
        this.browserUtil.openBrowser(firewallHelpLink);
    }
}
exports.WorkspacePromptsUtil = WorkspacePromptsUtil;

//# sourceMappingURL=WorkspacePromptsUtil.js.map
