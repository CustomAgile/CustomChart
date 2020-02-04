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

// Ext.override(Rally.ui.combobox.FieldComboBox, {
//     _populateStore: function () {
//         if (!this.store) {
//             return;
//         }
//         var data = _.sortBy(
//             _.map(
//                 _.filter(this.model.getFields(), this._isNotHidden),
//                 this._convertFieldToLabelValuePair,
//                 this
//             ),
//             'name'
//         );

//         console.log(data);

//         this.store.loadRawData(data);
//         this._onStoreLoad();
//         this.setDefaultValue();
//         this.onReady();
//     }
// });