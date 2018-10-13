"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/** Names of restricted operations. */
var WellKnownRestrictedOperations;
(function (WellKnownRestrictedOperations) {
    WellKnownRestrictedOperations["Edit"] = "Edit";
    WellKnownRestrictedOperations["FileAccess"] = "FileAccess";
    WellKnownRestrictedOperations["CodeAction"] = "CodeAction";
    WellKnownRestrictedOperations["RunTask"] = "RunTask";
    WellKnownRestrictedOperations["Build"] = "Build";
    WellKnownRestrictedOperations["LaunchDebug"] = "LaunchDebug";
    WellKnownRestrictedOperations["DebugContinue"] = "DebugContinue";
    WellKnownRestrictedOperations["DebugSetVariable"] = "DebugSetVariable";
    WellKnownRestrictedOperations["DebugEvaluate"] = "DebugEvaluate";
    WellKnownRestrictedOperations["WriteToSharedTerminal"] = "WriteToSharedTerminal";
})(WellKnownRestrictedOperations = exports.WellKnownRestrictedOperations || (exports.WellKnownRestrictedOperations = {}));
/** Reason why a restricted operation can be rejected. */
var RestrictedOperationRejectionReason;
(function (RestrictedOperationRejectionReason) {
    RestrictedOperationRejectionReason["RejectedInReadOnlySession"] = "RejectedInReadOnlySession";
    RestrictedOperationRejectionReason["RejectedForNotOwner"] = "RejectedForNotOwner";
    RestrictedOperationRejectionReason["DisabledByHost"] = "DisabledByHost";
})(RestrictedOperationRejectionReason = exports.RestrictedOperationRejectionReason || (exports.RestrictedOperationRejectionReason = {}));

//# sourceMappingURL=restrictedOperation.js.map
