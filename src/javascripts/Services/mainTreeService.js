ngapp.service('mainTreeService', function(recordTreeViewFactory) {
    this.buildFunctions = function(scope) {
        // helper variables
        let ctClasses = ['ct-unknown', 'ct-ignored', 'ct-not-defined', 'ct-identical-to-master', 'ct-only-one', 'ct-hidden-by-mod-group', 'ct-master', 'ct-conflict-benign', 'ct-override', 'ct-identical-to-master-wins-conflict', 'ct-conflict-wins', 'ct-conflict-loses'];
        let caClasses = ['ca-unknown', 'ca-only-one', 'ca-no-conflict', 'ca-conflict-benign', 'ca-override', 'ca-conflict', 'ca-conflict-critical'];

        // helper functions
        let reExpandNode = function(node) {
            let newNode = scope.getNodeForElement(node.handle);
            if (newNode) {
                scope.getNodeData(newNode);
                scope.expandNode(newNode);
            }
        };

        let reSelectNode = function(node, scroll) {
            let newNode = scope.getNodeForElement(node.handle);
            if (newNode) {
                scope.selectSingle(newNode, true, true, false);
                if (scroll) scope.scrollToNode(newNode, true);
            }
        };

        let freeHandles = function(nodes1, nodes2) {
            let a = [];
            nodes1.forEach((n) => a.contains(n.handle) || a.push(n.handle));
            nodes2.forEach((n) => a.contains(n.handle) || a.push(n.handle));
            a.forEach((handle) => xelib.Release(handle));
        };

        // scope functions
        scope.getNodeClass = function(node) {
            let classes = [];
            //if (xelib.GetModified(node.handle)) classes.push('modified');
            if (node.element_type === xelib.etMainRecord && node.fid > 0) {
                if (xelib.IsInjected(node.handle)) classes.push('injected');
                let conflictData = xelib.GetRecordConflictData(node.handle);
                classes.push(caClasses[conflictData[0]]);
                classes.push(ctClasses[conflictData[1]]);
            }
            node.class = classes.join(' ');
        };

        scope.reloadNodes = function() {
            scope.reloading = true;
            let start = Date.now(),
                oldExpandedNodes = [],
                oldSelectedNodes = scope.selectedNodes.slice();
            scope.tree.forEach(function(node) {
                if (node.expanded) {
                    oldExpandedNodes.push(node);
                } else {
                    if (!node.selected) xelib.Release(node.handle);
                    recordTreeViewFactory.releaseChildren(node);
                }
            });
            scope.clearSelection(true);
            scope.buildTree();
            oldExpandedNodes.forEach((n) => reExpandNode(n));
            oldSelectedNodes.forEach((n, i, a) => reSelectNode(n, i == a.length - 1));
            freeHandles(oldExpandedNodes, oldSelectedNodes);
            console.log(`Rebuilt tree (${scope.tree.length} nodes) in ${Date.now() - start}ms`);
        };

        scope.getCanExpand = function(node) {
            if (node.element_type === xelib.etMainRecord) {
                let childGroup = xelib.GetElement(node.handle, 'Child Group', true);
                node.can_expand = childGroup && xelib.ElementCount(childGroup) > 0;
            } else {
                node.can_expand = xelib.ElementCount(node.handle) > 0;
            }
        };

        scope.buildColumnValues = function(node) {
            node.column_values = scope.columns.map(function(column) {
                try {
                    return column.getData(node, xelib);
                } catch (x) {
                    console.log(x);
                    return { value: '' };
                }
            }).trimFalsy();
        };

        scope.getNodeData = function(node) {
            node.element_type = xelib.ElementType(node.handle);
            node.has_data = true;
            if (node.element_type === xelib.etMainRecord) {
                node.fid = xelib.GetFormID(node.handle);
            }
            scope.getNodeClass(node);
            scope.getCanExpand(node);
            scope.buildColumnValues(node);
        };

        scope.buildNode = function(handle, depth) {
            return {
                handle: handle,
                depth: depth + 1
            }
        };

        scope.buildNodes = function(node) {
            let path = node.element_type === xelib.etMainRecord ? 'Child Group' : '';
            return xelib.GetElements(node.handle, path, true).map(function(handle) {
                return scope.buildNode(handle, node.depth);
            });
        };
    };
});