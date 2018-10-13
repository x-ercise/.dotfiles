"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class AuthenticationFindCodeUtilMacWin {
    constructor(authService) {
        this.authService = authService;
    }
    async findLoginCode(instanceId, cancellationToken) {
        return await this.authService.findLoginCodeAsync(instanceId, cancellationToken);
    }
}
exports.AuthenticationFindCodeUtilMacWin = AuthenticationFindCodeUtilMacWin;

//# sourceMappingURL=AuthenticationFindCodeUtilMacWin.js.map
