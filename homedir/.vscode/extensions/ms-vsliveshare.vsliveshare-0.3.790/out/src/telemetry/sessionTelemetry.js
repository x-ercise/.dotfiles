"use strict";
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
Object.defineProperty(exports, "__esModule", { value: true });
const session_1 = require("../session");
const sessionTypes_1 = require("../sessionTypes");
const telemetry_1 = require("./telemetry");
const telemetryStrings_1 = require("./telemetryStrings");
class SessionTelemetry {
    static reset() {
        this.resetActiveEvent(false);
        if (!this.listenerAdded) {
            this.listenerAdded = true;
            session_1.SessionContext.addListener(sessionTypes_1.SessionEvents.HasCollaboratorsChanged, (hasCollaborators, hadCollaborators) => {
                this.activeEvent.end(telemetry_1.TelemetryResult.Success);
                this.resetActiveEvent(hasCollaborators);
            });
        }
    }
    static end() {
        if (this.activeEvent) {
            this.activeEvent.end(telemetry_1.TelemetryResult.Success);
        }
    }
    static resetActiveEvent(hasCollaborators) {
        this.activeEvent = new telemetry_1.TimedEvent(SessionTelemetryEventNames.HAS_COLLABORATORS_CHANGED);
        this.activeEvent.addProperty(SessionTelemetryPropertyNames.HAS_COLLABORATORS, hasCollaborators);
    }
}
exports.SessionTelemetry = SessionTelemetry;
class SessionTelemetryEventNames {
}
SessionTelemetryEventNames.HAS_COLLABORATORS_CHANGED = 'change-hascollaborators';
class SessionTelemetryPropertyNames {
}
SessionTelemetryPropertyNames.HAS_COLLABORATORS = telemetryStrings_1.TelemetryPropertyNames.FEATURE_NAME + 'HasCollaborators';

//# sourceMappingURL=sessionTelemetry.js.map
