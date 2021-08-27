"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorNode = void 0;
const vscode = require("vscode");
class ErrorNode {
    constructor(collection, id, errorMessage) {
        this.collection = collection;
        this.id = id;
        this.errorMessage = errorMessage;
    }
    getTreeItem() {
        const adapterDelegate = this.collection.adapter;
        let label = adapterDelegate.adapter.constructor.name.replace(/(.*)Adapter/, "$1");
        if (this.collection.adapter.workspaceFolder && vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 1)) {
            label = `${this.collection.adapter.workspaceFolder.name} - ${label}`;
        }
        label += ': Error';
        const treeItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        treeItem.id = this.id;
        treeItem.iconPath = this.collection.explorer.iconPaths.errored;
        treeItem.contextValue = 'error';
        treeItem.command = {
            title: '',
            command: 'test-explorer.show-error',
            arguments: [this.errorMessage]
        };
        treeItem.tooltip = 'Error while loading tests - click to show';
        return treeItem;
    }
    get children() { return []; }
}
exports.ErrorNode = ErrorNode;
//# sourceMappingURL=errorNode.js.map