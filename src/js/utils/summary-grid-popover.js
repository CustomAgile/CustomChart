Ext.define('CustomAgile.ui.popover.SummaryGridPopover', {
    alias: 'widget.summarygridpopover',
    extend: 'Rally.ui.popover.Popover',

    id: 'grid-popover',
    cls: 'grid-popover',

    title: 'Grouping Details',
    width: 750,
    maxHeight: 600,

    layout: 'fit',

    constructor: function (config) {
        var items = [{
            xtype: 'rallygrid',
            itemId: 'listview',
            store: Ext.create('Rally.data.wsapi.artifact.Store', {
                models: config.models,
                data: config.data,
                pageSize: config.data.length,
                autoLoad: false
            }),
            columnCfgs: config.columns,
            sortableColumns: false,
            showRowActionsColumn: false,
            showPagingToolbar: false,
            enableEditing: false,
            flex: 1,
            overflowY: 'auto'
        }];

        config.items = Ext.merge(items, config.items);

        this.callParent(arguments);
    },

    getGrid: function () {
        return this.down('#listview');
    }
});