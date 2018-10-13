"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const azure_account_1 = require("./azure-account");
const azure_arm_resource_1 = require("azure-arm-resource");
const path = require("path");
const opn = require("opn");
function readResourceTypes() {
    const resourceTypes = {};
    for (const extension of vscode_1.extensions.all) {
        const pkg = extension.packageJSON;
        const types = pkg && pkg.contributes && pkg.contributes['azure-account.resourceTypes'] || [];
        types.forEach((t) => {
            resourceTypes[t.kind ? `${t.id}:${t.kind}` : t.id] = {
                extension,
                id: t.id,
                kind: t.kind,
                iconPath: t.iconPath && path.join(extension.extensionPath, t.iconPath),
                provider: t.provider
            };
        });
    }
    return resourceTypes;
}
class ResourceTypeRegistry {
    constructor() {
        this.types = readResourceTypes();
        this.providerExtensions = Object.keys(this.types)
            .reduce((m, id) => {
            const type = this.types[id];
            if (type.provider) {
                m[type.provider] = type.extension;
            }
            return m;
        }, {});
        this.providers = {};
        this.didChangeTreeData = new vscode_1.EventEmitter();
        this.onDidChangeTreeData = this.didChangeTreeData.event;
    }
    registerResourceTypeProvider(id, provider) {
        if (this.providers[id]) {
            throw new Error(`A resource type provider with the same id is already registered: ${id}`);
        }
        this.providers[id] = provider;
        if (provider.treeDataProvider.onDidChangeTreeData) {
            const subscription = provider.treeDataProvider.onDidChangeTreeData(node => this.didChangeTreeData.fire(node));
            return { dispose: () => subscription.dispose() };
        }
        return { dispose: () => { } };
    }
    loadResourceTypeProvider(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.providerExtensions[id].activate(); // TODO: Add activation event.
            return this.providers[id];
        });
    }
}
exports.ResourceTypeRegistry = ResourceTypeRegistry;
const subscriptionIconPath = path.resolve(__dirname, '../../images/azureSubscription.svg');
function createSubscriptionNode(session, model) {
    const treeItem = new vscode_1.TreeItem(model.displayName, vscode_1.TreeItemCollapsibleState.Expanded);
    treeItem.id = model.id;
    treeItem.iconPath = subscriptionIconPath;
    treeItem.contextValue = 'subscription';
    return { provider: undefined, session, model, treeItem };
}
const resourceGroupIconPath = path.resolve(__dirname, '../../images/resourceGroup.svg');
function createResourceGroupNode(session, model) {
    const treeItem = new vscode_1.TreeItem(model.name, vscode_1.TreeItemCollapsibleState.Collapsed);
    treeItem.id = model.id;
    treeItem.iconPath = resourceGroupIconPath;
    treeItem.contextValue = 'resourceGroup';
    return { provider: undefined, session, model, treeItem };
}
const genericIcon = path.resolve(__dirname, '../../images/genericService.svg');
function createResourceNode(session, model, resourceType) {
    const treeItem = new vscode_1.TreeItem(model.name);
    treeItem.id = model.id;
    const selector = model.kind ? `${model.type}:${model.kind}` : model.type;
    treeItem.iconPath = resourceType && resourceType.iconPath || genericIcon;
    treeItem.contextValue = `resource:${selector}`;
    return { provider: undefined, session, model, treeItem };
}
function loadResourceGroups(node) {
    return __awaiter(this, void 0, void 0, function* () {
        const client = new azure_arm_resource_1.ResourceManagementClient(node.session.credentials, node.model.subscriptionId).resourceGroups;
        const resourceGroups = yield azure_account_1.listAll(client, client.list());
        return resourceGroups.map(resourceGroup => createResourceGroupNode(node.session, resourceGroup));
    });
}
function loadResources(node, resourceTypeRegistry) {
    return __awaiter(this, void 0, void 0, function* () {
        const subscriptionId = node.model.id.split('/')[2];
        const client = new azure_arm_resource_1.ResourceManagementClient(node.session.credentials, subscriptionId).resourceGroups;
        const resources = yield azure_account_1.listAll(client, client.listResources(node.model.name));
        return Promise.all(resources.map((resource) => __awaiter(this, void 0, void 0, function* () {
            const selector = resource.kind ? `${resource.type}:${resource.kind}` : resource.type;
            const resourceType = resourceTypeRegistry.types[selector];
            const child = createResourceNode(node.session, resource, resourceType);
            if (resourceType && resourceType.provider) {
                const provider = yield resourceTypeRegistry.loadResourceTypeProvider(resourceType.provider);
                return provider.adaptResourceNode(child);
            }
            return child;
        })));
    });
}
function isResourceNode(node) {
    return node.provider === undefined;
}
class ResourceTreeProvider {
    constructor(account, resourceTypeRegistry) {
        this.account = account;
        this.resourceTypeRegistry = resourceTypeRegistry;
        this.didChangeTreeData = new vscode_1.EventEmitter();
        this.onDidChangeTreeData = this.didChangeTreeData.event;
        this.subscriptions = [];
        this.subscriptions.push(account.onFiltersChanged(() => this.didChangeTreeData.fire()));
        this.subscriptions.push(this.resourceTypeRegistry.onDidChangeTreeData(node => this.didChangeTreeData.fire(node)));
    }
    getChildren(element) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!element) {
                const subscriptions = this.account.filters
                    .map(subscription => createSubscriptionNode(subscription.session, subscription.subscription));
                if (subscriptions.length === 1) {
                    return loadResourceGroups(subscriptions[0]);
                }
                return subscriptions;
            }
            else if (!isResourceNode(element)) {
                const provider = yield this.resourceTypeRegistry.loadResourceTypeProvider(element.provider);
                return provider.treeDataProvider.getChildren(element);
            }
            else if (element.treeItem.contextValue === 'subscription') {
                return loadResourceGroups(element);
            }
            else if (element.treeItem.contextValue === 'resourceGroup') {
                return loadResources(element, this.resourceTypeRegistry);
            }
            return [];
        });
    }
    getTreeItem(element) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!isResourceNode(element)) {
                const provider = yield this.resourceTypeRegistry.loadResourceTypeProvider(element.provider);
                return provider.treeDataProvider.getTreeItem(element);
            }
            return element.treeItem;
        });
    }
    dispose() {
        for (const subscription of this.subscriptions) {
            try {
                subscription.dispose();
            }
            catch (err) {
                console.error(err);
            }
        }
        this.subscriptions.length = 0;
    }
}
function openInPortal(node) {
    opn(`${node.session.environment.portalUrl}/${node.session.tenantId}/#resource${node.model.id}`);
}
function activate(context, account, resourceTypeRegistry) {
    const resourceTreeProvider = new ResourceTreeProvider(account, resourceTypeRegistry);
    context.subscriptions.push(resourceTreeProvider, vscode_1.window.registerTreeDataProvider('azure-account.resourceView', resourceTreeProvider), vscode_1.commands.registerCommand('azure-account.openInPortal', openInPortal));
}
exports.activate = activate;
//# sourceMappingURL=resourceView.js.map