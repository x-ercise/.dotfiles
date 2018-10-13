//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Well-known scopes of terminal worker lifetime.
 */
var WorkerScope;
(function (WorkerScope) {
    /**
     * Worker is limited to the lifetime of a collaboration session.
     */
    WorkerScope["session"] = "session";
    /**
     * Worker lifetime is not limited.
     */
    WorkerScope["global"] = "global";
})(WorkerScope = exports.WorkerScope || (exports.WorkerScope = {}));
/**
 * List of well-known metadata properties linked to a terminal cache entry.
 */
var MetadataKey;
(function (MetadataKey) {
    MetadataKey["id"] = "id";
    MetadataKey["prompt"] = "prompt";
})(MetadataKey = exports.MetadataKey || (exports.MetadataKey = {}));
/**
 * Terminal cache entry containing metadata associated with a shared terminal.
 * It will dispose the terminal window if created with own === true.
 */
class TerminalEntry {
    constructor(terminal, own, workers) {
        this.terminal = terminal;
        this.own = own;
        this.workers = workers;
        this.metadata = {};
    }
    /**
     * Disposes the terminal instance (if own) and all associated workers.
     */
    dispose() {
        this.workers.forEach(t => t.dispose());
        if (this.own) {
            this.terminal.dispose();
        }
    }
    /**
     * Retrieve a metadata value given the key.
     *
     * @param metadataKey Desired metadata key.
     */
    get(metadataKey) {
        return this.metadata[metadataKey];
    }
    /**
     * Update metadata value associated with the given key.
     *
     * @param metadataKey Desired metadata key.
     * @param value Metadata value.
     */
    update(metadataKey, value) {
        this.metadata[metadataKey] = value;
    }
}
/**
 * Contains cached terminal entries tracked by terminal controllers which may register or alter them.
 */
class TerminalCache {
    constructor() {
        this.terminalEntries = [];
    }
    /**
     * Removes and disposes terminal entries given a scope filter.
     *
     * @param sessionOnly Indicates whether only session-scoped entries should be removed.
     */
    clean(sessionOnly) {
        if (sessionOnly) {
            // remove all own terminals
            const ownTerminals = this.terminalEntries.filter(x => x.own).map(x => x.terminal);
            ownTerminals.forEach(t => this.remove(t));
            // dispose session-scoped workers
            for (const entry of this.terminalEntries) {
                let workersByScope = {};
                workersByScope = entry.workers.splice(0).reduce((wbs, w) => (Object.assign({}, wbs, { [w.scope]: [...(wbs[w.scope] || []), w] })), workersByScope);
                entry.workers.push(...workersByScope[WorkerScope.global]);
                workersByScope[WorkerScope.session].forEach(d => d.dispose());
            }
        }
        else {
            const removed = this.terminalEntries.splice(0);
            removed.forEach(t => t.dispose());
        }
    }
    has(terminal) {
        const entry = this.terminalEntries.find(x => x.terminal === terminal);
        return !!entry;
    }
    get(terminal) {
        const entry = this.terminalEntries.find(x => x.terminal === terminal);
        return entry;
    }
    hasId(id) {
        const entry = this.terminalEntries.find(x => x.get(MetadataKey.id) === `${id}`);
        return !!entry;
    }
    getById(id) {
        const entry = this.terminalEntries.find(x => x.get(MetadataKey.id) === `${id}`);
        return entry;
    }
    /**
     * Registers a new terminal entry in the cache or updates an existing one when it's already been registered.
     *
     * @param terminal Terminal window.
     * @param id Optional ID of the terminal.
     * @param own Indicates whether this terminal is created by VSLS controller.
     * @param workers List of terminal workers associated with the terminal.
     */
    register(terminal, id, own, ...workers) {
        let terminalEntry;
        if (!this.has(terminal)) {
            terminalEntry = new TerminalEntry(terminal, own, workers);
            this.terminalEntries.push(terminalEntry);
        }
        else {
            terminalEntry = this.get(terminal);
            terminalEntry.own = own || terminalEntry.own;
            terminalEntry.workers.push(...workers);
        }
        if (id !== null) {
            terminalEntry.update(MetadataKey.id, `${id}`);
        }
        return terminalEntry;
    }
    /**
     * Removes the terminal entry associated with the given terminal window.
     *
     * @param terminal Terminal window
     */
    remove(terminal) {
        const index = this.terminalEntries.findIndex(x => x.terminal === terminal);
        if (index !== -1) {
            const entry = this.terminalEntries[index];
            entry.dispose();
            this.terminalEntries.splice(index, 1);
        }
    }
}
exports.TerminalCache = TerminalCache;
/**
 * Determines whether the given terminal is used for running tasks.
 *
 * @param terminal Terminal window
 */
function isTaskTerminal(terminal) {
    return !!terminal.name && terminal.name.startsWith('Task');
}
exports.isTaskTerminal = isTaskTerminal;
/**
 * Determines whether the given terminal window is created by VSLS controller.
 *
 * @param terminal Terminal window
 */
function isSharedTerminal(terminal) {
    return !!terminal.name && terminal.name.endsWith('[Shared]');
}
exports.isSharedTerminal = isSharedTerminal;

//# sourceMappingURL=terminalTypes.js.map
