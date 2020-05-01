Ext.define('CustomAgile.ui.ChartGridToggleButton', {
    extend: 'Rally.ui.gridboard.GridBoardToggle',
    alias: 'widget.chartgridtogglebtn',

    stateful: true,
    stateEvents: ['toggle'],

    _getItems: function () {
        return []
            .concat(this._getToggleConfig('grid', { tooltipText: 'Switch to Grid View', iconCls: 'icon-grid', anchorOffset: 65 }))
            .concat(this._getToggleConfig('chart', { tooltipText: 'Switch to Chart View', anchorOffset: 45, iconCls: 'icon-pie' }))
            .concat(this._getToggleConfig('both', { tooltipText: 'Show Both Grid and Chart', anchorOffset: 90, iconCls: 'icon-both', text: '+' }));
    },

    _getToggleConfig: function (toggleState, options) {
        return {
            itemId: toggleState,
            cls: 'toggle ' + toggleState,
            iconCls: options.iconCls,
            frame: false,
            text: options.text,
            toolTipConfig: {
                html: options.tooltipText,
                anchor: 'top',
                hideDelay: 0,
                constrainPosition: false,
                anchorOffset: options.anchorOffset,
                mouseOffset: [-1 * options.anchorOffset, 0]
            }
        };
    },

    getState: function () {
        return { toggleState: this.toggleState };
    },

    applyState: function (state) {
        this.toggleState = state.toggleState;
        this.items.each(function (item) {
            if (item.getItemId() === this.toggleState) {
                item.addCls(this.activeButtonCls);
            } else {
                item.removeCls(this.activeButtonCls);
            }
        }, this);
    }
});