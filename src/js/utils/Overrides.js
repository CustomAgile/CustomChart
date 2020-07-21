Ext.override(Rally.ui.gridboard.Export, {
    // Override to also look at the cmp initial config storeConfig value
    _getScopeParams: function (cmp) {
        var context = (cmp.store && cmp.store.context) ||
            (cmp.initialConfig && cmp.initialConfig.storeConfig && cmp.initialConfig.storeConfig.context) ||
            cmp.getContext().getDataContext();

        return {
            workspace: context.workspace,
            project: context.project,
            projectScopeDown: context.projectScopeDown,
            projectScopeUp: context.projectScopeUp
        };
    }
});

// Ext.override(Rally.data.wsapi.Store, {
//     fireEvent: function () {
//         console.log(arguments);
//         this.callParent(arguments);
//     }
// });

Ext.override(Ext.util.Sorter, {
    defaultSorterFn: function (o1, o2) {
        var me = this,
            transform = me.transform,
            v1 = me.getRoot(o1)[me.property],
            v2 = me.getRoot(o2)[me.property];

        if (transform) {
            v1 = transform(v1);
            v2 = transform(v2);
        }

        if (v1 == null) {
            v1 = "";
        }

        if (v2 == null) {
            v2 = "";
        }

        if (typeof v1 === 'object') {
            if (typeof v1._refObjectName === 'string') {
                v1 = v1._refObjectName;
            }
        }

        if (typeof v2 === 'object') {
            if (typeof v2._refObjectName === 'string') {
                v2 = v2._refObjectName;
            }
        }

        return v1 > v2 ? 1 : (v1 < v2 ? -1 : 0);
    }
});

Ext.override(Rally.ui.chart.Chart, {
    // When we sort the detailed grid, it triggers this function
    // If this store is already loaded, just return
    _storeLoadHandler: function (store) {
        if (typeof this.loadedStores === 'object' && store.storeId === this.loadedStores.storeId) {
            return;
        }

        this.callParent(arguments);
    }
});

Ext.override(Rally.ui.combobox.FieldComboBox, {
    _populateStore: function () {
        if (!this.store) {
            return;
        }
        var data = _.sortBy(
            _.map(
                _.filter(this.model.getFields(), this._isNotHidden),
                this._convertFieldToLabelValuePair,
                this
            ),
            'name'
        );

        this.store.loadRawData(data);
        this._onStoreLoad();
        this.setDefaultValue();
        this.onReady();
    }
});

Ext.override(Rally.ui.picker.FieldPicker, {
    _buildStoreData: function (models) {
        let data = this.callParent(arguments);
        if (_.contains(Object.keys(data), 'Predecessors')) {
            if (!_.contains(Object.keys(data), 'PredecessorsAndSuccessors')) {
                data.PredecessorsAndSuccessors = {
                    displayName: 'Dependencies',
                    name: 'PredecessorsAndSuccessors'
                };
            }
            delete data.Predecessors;
            delete data.Successors;
        }
        return data;
    }
});

Ext.override(Rally.ui.dialog.SharedViewDialog, {
    /* 
        Dialog and Combobox weren't refreshing after adding a new shared
        view, so here we are 
    */
    _onCreate: function (dialog, record) {
        if (this.grid) {
            this.grid.getStore().reload();
        }
        let newPrefRef = record.get('_ref');
        let combobox = Rally.getApp().down('#customChartSharedViewCombobox');

        if (newPrefRef && combobox) {
            combobox.getStore().reload();
            combobox.setValue(newPrefRef);
            combobox.saveState();
        }

        this.down('#doneButton').focus();
    },
});



// Ext.override(Rally.ui.inlinefilter.InlineFilterControl, {
//     /* 
//         Dialog and Combobox weren't refreshing after adding a new shared
//         view, so here we are 
//     */


//     _onFilterChange: function () {
//         var app = Rally.getApp();
//         app.settingView = false;
//         this.callParent(arguments);
//     }
// });
