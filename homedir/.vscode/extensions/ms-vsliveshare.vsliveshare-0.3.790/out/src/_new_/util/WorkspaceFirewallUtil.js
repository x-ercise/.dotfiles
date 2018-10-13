"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vsls = require("../../contracts/VSLS");
const config_1 = require("../../config");
/**
 * Helper functions for performing firewall checks.
 */
class WorkspaceFirewallUtil {
    constructor(firewallService, workspacePromptsUtil, configUtil) {
        this.firewallService = firewallService;
        this.workspacePromptsUtil = workspacePromptsUtil;
        this.configUtil = configUtil;
    }
    /// <summary>
    /// Performs firewall rules check for the vsls-agent.exe process.
    /// </summary>
    /// <param name="session">Current client session.</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>True if sharing operation should continue, false otherwise.</returns>
    async performFirewallCheckAsync() {
        let connectionMode = this.configUtil.get(config_1.Key.connectionMode);
        if (vsls.ConnectionMode.Auto === connectionMode ||
            vsls.ConnectionMode.Direct === connectionMode) {
            let firewallStatus = await this.firewallService.getFirewallStatusAsync();
            if (vsls.FirewallStatus.Block === firewallStatus) {
                switch (connectionMode) {
                    case vsls.ConnectionMode.Direct:
                        await this.workspacePromptsUtil.showFirewallInformationMessage('error.BlockActionDirectModePrompt', false);
                        return false;
                    case vsls.ConnectionMode.Auto:
                        if (await this.workspacePromptsUtil.showFirewallInformationMessage('warning.BlockActionAutoModePrompt', true)) {
                            await this.configUtil.save(config_1.Key.connectionMode, vsls.ConnectionMode.Relay, true, true);
                            return true;
                        }
                        return false;
                    default:
                        break;
                }
            }
            else if (vsls.FirewallStatus.None === firewallStatus) {
                switch (connectionMode) {
                    case vsls.ConnectionMode.Direct:
                        await this.workspacePromptsUtil.showFirewallInformationMessage('info.NoneActionDirectModePrompt', false);
                        break;
                    case vsls.ConnectionMode.Auto:
                        await this.workspacePromptsUtil.showFirewallInformationMessage('info.NoneActionAutoModePrompt', false);
                        break;
                    default:
                        break;
                }
            }
        }
        return true;
    }
}
exports.WorkspaceFirewallUtil = WorkspaceFirewallUtil;

//# sourceMappingURL=WorkspaceFirewallUtil.js.map
