"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const session_1 = require("../../session");
/**
 * Listens to agent session context updates and wires them through the
 * clients session context state/status chances.
 */
class AgentSessionContextUpdateListener {
    constructor(sessionContextService, sessionContext, trace) {
        this.sessionContextService = sessionContextService;
        this.sessionContext = sessionContext;
        this.trace = trace;
    }
    subscribe() {
        this.stateDisposable = this.sessionContextService.onSessionStateUpdate((e) => {
            const action = session_1.SessionAction[e.value];
            if (action === undefined) {
                throw new Error(`Unrecognized state transition attempted - "${e.value}".`);
            }
            this.sessionContext.transition(action);
        });
        this.statusDisposable = this.sessionContextService.onSessionStatusUpdate((e) => {
            this.sessionContext.point('liveshare.' + e.value);
        });
    }
    dispose() {
        if (this.stateDisposable !== undefined) {
            this.stateDisposable.dispose();
        }
        if (this.statusDisposable !== undefined) {
            this.statusDisposable.dispose();
        }
    }
}
exports.AgentSessionContextUpdateListener = AgentSessionContextUpdateListener;

//# sourceMappingURL=AgentSessionContextUpdateListener.js.map
