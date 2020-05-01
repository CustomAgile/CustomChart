Ext.define('CustomChartApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    layout: 'border',

    items: [{
        region: 'north',
        xtype: 'container',
        itemId: 'filter-area',
        margin: 10,
        overflowY: 'auto', // flex: 1,
        items: [{
            id: Utils.AncestorPiAppFilter.RENDER_AREA_ID,
            xtype: 'container',
            layout: {
                type: 'hbox',
                align: 'middle',
                defaultMargins: '0 10 10 0',
            }
        }, {
            id: Utils.AncestorPiAppFilter.PANEL_RENDER_AREA_ID,
            xtype: 'container',
            layout: {
                type: 'hbox',
                align: 'middle',
                defaultMargins: '0 10 10 0',
            }
        }]
    }, {
        itemId: 'chart-area',
        region: 'center',
        xtype: 'container',
        flex: 2,
        overflowY: 'auto',
        type: 'vbox',
        align: 'stretch',
        defaultMargins: 10
    },
    {
        itemId: 'grid-area',
        region: 'south',
        margin: 10,
        split: {
            draggable: true,
            size: 7,
            margin: '8 0 8 0'
        },
        xtype: 'panel',
        animCollapse: false,
        collapseMode: 'mini',
        hideCollapseTool: true,
        // collapsed: true,
        border: false,
        height: 260,
        type: 'vbox',
        align: 'stretch',
    }
    ],
    config: {
        defaultSettings: {
            types: 'Defect',
            chartType: 'piechart',
            aggregationField: 'State',
            aggregationType: 'count',
            bucketBy: '',
            stackField: '',
            query: ''
        }
    },

    launch: function () {
        Rally.data.wsapi.Proxy.superclass.timeout = 240000;

        if (!this.getSetting('types')) {
            this.fireEvent('appsettingsneeded'); //todo: does this work?
        }
        else {
            this.addExportBtn();

            this.down('#grid-area').on('resize', this.onGridAreaResize, this);
            this.down('#filter-area').on('resize', this.onGridAreaResize, this);

            this.ancestorFilterPlugin = Ext.create('Utils.AncestorPiAppFilter', {
                ptype: 'UtilsAncestorPiAppFilter',
                pluginId: 'ancestorFilterPlugin',
                settingsConfig: {},
                filtersHidden: false,
                whiteListFields: ['Milestones', 'Tags', 'c_EnterpriseApprovalEA', 'c_EAEpic', 'DisplayColor'],
                visibleTab: this.getSetting('types'),
                listeners: {
                    scope: this,
                    ready: function (plugin) {
                        this.portfolioItemTypes = plugin.getPortfolioItemTypes();
                        Rally.data.wsapi.ModelFactory.getModels({
                            types: this._getTypesSetting(),
                            scope: this
                        }).then({
                            success: this._onModelsLoaded,
                            scope: this
                        }).then({
                            scope: this,
                            success: function () {
                                plugin.addListener({
                                    scope: this,
                                    select: this._addChart,
                                    change: this._addChart
                                });
                                this.addToggleBtn();
                                // this.addShowGridBtn();
                                this._addChart();
                            }
                        });
                    },
                }
            });
            this.addPlugin(this.ancestorFilterPlugin);
        }
    },

    addExportBtn: function () {
        this.down('#' + Utils.AncestorPiAppFilter.RENDER_AREA_ID).add({
            xtype: 'rallybutton',
            id: 'exportReportBtn',
            iconCls: 'icon-export',
            iconOnly: false,
            cls: 'x4-btn secondary rly-small x4-unselectable export',
            toolTipConfig: {
                html: 'Export',
                anchor: 'top',
                hideDelay: 0
            },
            handler: (btn) => {
                let menu = Ext.widget({
                    xtype: 'rallymenu',
                    items: [{
                        text: 'Export to CSV...',
                        handler: this._export,
                        scope: this
                    }]
                });

                menu.showBy(btn.getEl());

                if (btn.toolTip) {
                    btn.toolTip.hide();
                }
            }
        });
    },

    // addShowGridBtn: function () {
    //     this.down('#' + Utils.AncestorPiAppFilter.RENDER_AREA_ID).add({
    //         xtype: 'rallybutton',
    //         id: 'showGridBtn',
    //         text: 'Show Data Grids <span class="icon-arrow-down" style="color:red"></span>',
    //         handler: (btn) => {
    //             this.down('#grid-area').toggleCollapse();

    //             btn.setText(btn.text === 'Show Data Grids' ? 'Hide Data Grids' : 'Show Data Grids');
    //         }
    //     });
    // },

    addToggleBtn: function () {
        this.down('#' + Utils.AncestorPiAppFilter.RENDER_AREA_ID).add({
            xtype: 'chartgridtogglebtn',
            itemId: 'chartGridToggleBtn',
            toggleState: 'chart',
            stateId: this.getContext().getScopedStateId('customchart-toggle-btn'),
            listeners: {
                scope: this,
                toggle: this.onChartGridToggle
            }
        });
    },

    onChartGridToggle: function (btn, toggleState) {
        if (toggleState === 'chart') {
            this.down('#grid-area').hide();
            this.grids.hide();
            this.gridboard.show();
            this.gridboard.setHeight(this.down('#chart-area').getHeight());
            this.gridboard.getGridOrBoard().setHeight(this.down('#chart-area').getHeight());
        }
        else if (toggleState === 'grid') {
            this.down('#grid-area').hide();
            this.gridboard.hide();
            this.down('#chart-area').add(this.grids);
            this.grids.show();
            this.grids.setHeight(this.down('#chart-area').getHeight());
            this.gridboard.setHeight(this.down('#chart-area').getHeight());
            this.gridboard.getGridOrBoard().setHeight(this.down('#chart-area').getHeight());
        }
        else if (toggleState === 'both') {
            this.down('#grid-area').show();
            this.down('#grid-area').add(this.grids);
            this.grids.show();
            this.gridboard.show();
            this.grids.setHeight(this.down('#grid-area').getHeight());
        }
        this.onGridAreaResize();
    },

    // Usual monkey business to size gridboards
    onResize: function () {
        this.callParent(arguments);
        var chartArea = this.down('#chart-area');
        if (chartArea && this.gridboard) {
            this.gridboard.setHeight(chartArea.getHeight());
        }
    },

    searchAllProjects: function () {
        return this.ancestorFilterPlugin.getIgnoreProjectScope();
    },

    getSettingsFields: function () {
        return Settings.getSettingsFields({
            context: this.getContext()
        });
    },

    _shouldLoadAllowedStackValues: function (stackingField) {
        var hasAllowedValues = stackingField && stackingField.hasAllowedValues(),
            shouldLoadAllowedValues = hasAllowedValues && (
                _.contains(['state', 'rating', 'string'], stackingField.getType()) ||
                stackingField.getAllowedValueType() === 'state' ||
                stackingField.getAllowedValueType() === 'flowstate'
            );
        return shouldLoadAllowedValues;
    },

    _onModelsLoaded: function (models) {
        var deferred = Ext.create('Deft.Deferred');
        var result = deferred.promise;

        this.models = [models[this.getSetting('types')]];// _.values(models);
        this.featureModel = models['PortfolioItem/Feature'];
        var model = this.models[0],
            stackingSetting = this._getStackingSetting(),
            stackingField = stackingSetting && model.getField(stackingSetting);

        if (this._shouldLoadAllowedStackValues(stackingField)) {
            result = stackingField.getAllowedValueStore().load().then({
                success: function (records) {
                    this.stackValues = _.invoke(records, 'get', 'StringValue');
                },
                scope: this
            });
        }
        else {
            deferred.resolve();
        }
        return result;
    },

    _addChart: async function () {
        // This object helps us cancel a load that is waiting for filters to be returned
        let thisStatus = { loadingFailed: false, cancelLoad: false };

        this._cancelPreviousLoad(thisStatus);

        var chartArea = this.down('#chart-area');
        chartArea.removeAll();
        chartArea.setLoading(true);

        var context = this.getContext();
        var dataContext = context.getDataContext();
        if (this.searchAllProjects()) {
            dataContext.project = null;
        }
        this._getFilters(thisStatus).then((filters) => {

            if (thisStatus.loadingFailed) {
                chartArea.setLoading(false);
                return;
            }

            if (thisStatus.cancelLoad) {
                return;
            }

            var modelNames = _.pluck(this.models, 'typePath'),
                gridBoardConfig = {
                    xtype: 'rallygridboard',
                    toggleState: 'chart',
                    height: chartArea.getHeight(),
                    chartConfig: this._getChartConfig(),
                    context: context,
                    modelNames: modelNames,
                    storeConfig: {
                        filters: filters,
                        context: dataContext,
                        enablePostGet: true
                    }
                };

            this.gridboard = chartArea.add(gridBoardConfig);
        });
    },

    _cancelPreviousLoad: function (newStatus) {
        if (this.globalStatus) {
            this.globalStatus.cancelLoad = true;
        }
        this.globalStatus = newStatus;

        // If there is a current chart store, force it to stop loading pages
        // Note that recreating the grid will then create a new chart store with
        // the same store ID.
        var chartStore = Ext.getStore('chartStore');
        if (chartStore) {
            chartStore.cancelLoad();
        }
    },

    _getQuickFilters: function () {
        var quickFilters = ['Owner', 'State', 'ScheduleState'],
            model = this.models[0];
        if (this.models.length > 1) {
            quickFilters.push('ModelType');
        }

        return _.filter(quickFilters, function (quickFilter) {
            return model.hasField(quickFilter);
        });
    },

    _getTypesSetting: function () {
        var types = this.getSetting('types').split(',');

        if (this._isFeatureFieldForStoryChart()) {
            types.push('PortfolioItem/Feature');
        }

        return types;
    },

    _getStackingSetting: function () {
        var chartType = this.getSetting('chartType');
        return chartType !== 'piechart' ? this.getSetting('stackField') : null;
    },

    _getChartConfig: function () {
        var chartType = this.getSetting('chartType'),
            stackField = this._getStackingSetting(),
            stackValues = this.stackValues,
            model = this.models[0],
            config = {
                xtype: chartType,
                enableStacking: !!stackField,
                title: { text: 'test' },
                chartColors: [
                    "#FF8200", // $orange
                    "#F6A900", // $gold
                    "#FAD200", // $yellow
                    "#8DC63F", // $lime
                    "#1E7C00", // $green_dk
                    "#337EC6", // $blue_link
                    "#005EB8", // $blue
                    "#7832A5", // $purple,
                    "#DA1884", // $pink,
                    "#C0C0C0" // $grey4
                ],
                storeConfig: {
                    storeId: 'chartStore',
                    context: this.getContext().getDataContext(),
                    //TODO: can we do summary fetch here and not limit infinity?
                    //we'll have to also make sure the fetch is correct for export somehow...
                    limit: 10000,
                    fetch: this._getChartFetch(),
                    sorters: this._getChartSort(),
                    pageSize: 2000,
                    enablePostGet: true,
                    listeners: {
                        scope: this,
                        load: function (store, records, successful) {
                            if (records.length === 10000) {
                                Rally.ui.notify.Notifier.showWarning({ message: 'Results limited to 10,000 to avoid timeouts' });
                            }

                            if (!successful) {
                                Rally.ui.notify.Notifier.showError({ message: 'Failed to load data, most likely caused by a server timeout. Try adjusting your scope or filters to reduce the amount of data returned.' });
                            }
                        }
                    }
                },
                calculatorConfig: {
                    calculationType: this.getSetting('aggregationType'),
                    field: this.getSetting('aggregationField'),
                    isFeatureFieldForStoryChart: this._isFeatureFieldForStoryChart(),
                    featureModel: this.featureModel,
                    stackField: stackField,
                    stackValues: stackValues,
                    bucketBy: chartType === 'piechart' ? null : this.getSetting('bucketBy')
                },
                listeners: {
                    scope: this,
                    storesLoaded: function () {
                        this.down('#chart-area').setLoading(false);
                    },
                    snapshotsAggregated: function (chart) {
                        this._addGrids(chart);
                        let toggleBtn = this.down('#chartGridToggleBtn');
                        this.onChartGridToggle(toggleBtn, toggleBtn.toggleState);
                    }
                }
            };

        if (model.isArtifact()) {
            config.storeConfig.models = [this.getSetting('types')];
            config.storeType = 'Rally.data.wsapi.artifact.Store';
        }
        else {
            config.storeConfig.model = model;
            config.storeType = 'Rally.data.wsapi.Store';
        }

        return config;
    },

    onGridAreaResize: function () {
        let tabPanel = this.down('#grid-area-tab-panel');

        if (tabPanel && !tabPanel.isHidden()) {
            if (this.down('#grid-area').isHidden()) {
                tabPanel.setHeight(this.down('#chart-area').getHeight());
            }
            else {
                tabPanel.setHeight(this.down('#grid-area').getHeight());
            }
            this.down('#summaryGrid').setHeight(tabPanel.getHeight() - 25);
            this.down('#detailedGrid').setHeight(tabPanel.getHeight() - 25);
        }

        if (this.gridboard && !this.gridboard.isHidden()) {
            this.gridboard.setHeight(this.down('#chart-area').getHeight());
        }
    },

    _addGrids: function (chart) {
        this.down('#grid-area').removeAll();
        let store = chart.loadedStores;
        let aggregationType = this.getSetting('aggregationType');
        let aggregationTypeField = ChartUtils.getFieldForAggregationType(aggregationType);
        let aggregationField = this.getSetting('aggregationField');
        let stackField = this._getStackingSetting();
        let isFeatureFieldForStory = this._isFeatureFieldForStoryChart();
        let aggregationDisplayName = isFeatureFieldForStory ? (this.featureModel && this.featureModel.getField(aggregationField) && this.featureModel.getField(aggregationField).displayName) || aggregationField :
            (this.models[0] && this.models[0].getField(aggregationField) && this.models[0].getField(aggregationField).displayName) || aggregationField;
        let stackFieldDisplayName = '';
        if (stackField) {
            stackFieldDisplayName = (this.models[0] && this.models[0].getField(stackField) && this.models[0].getField(stackField).displayName) || stackField;
        }
        let items = [];

        if (chart.chartData) {
            let data = [];
            let cols = [];

            if (stackField) {
                let categories = chart.chartData.categories;
                cols = [
                    { text: aggregationDisplayName, dataIndex: 'name', flex: 3 },
                    { text: stackFieldDisplayName, dataIndex: 'stackField', flex: 3 },
                    { text: aggregationType === 'count' ? 'Count' : aggregationTypeField, dataIndex: 'value', flex: 1 }
                ];

                for (let i = 0; i < categories.length; i++) {
                    let c = categories[i];
                    let secondaryRows = [];

                    let primaryRow = {
                        name: c,
                        stackField: '',
                        value: 0
                    }

                    for (let s of chart.chartData.series) {
                        let val = s.data[i];

                        if (val) {
                            primaryRow.value += val;

                            secondaryRows.push({
                                name: '',
                                stackField: s.name,
                                value: val
                            });
                        }
                    }

                    data = data.concat([primaryRow].concat(secondaryRows));
                }
            }
            else {
                let series = (chart.chartData && chart.chartData.series.length && chart.chartData.series[0]) || [];

                cols = [
                    { text: aggregationDisplayName, dataIndex: 'name', flex: 3 },
                    { text: aggregationType === 'count' ? 'Count' : aggregationTypeField, dataIndex: 'value', flex: 1 }
                ];

                data = _.map(series.data, function (r) {
                    return { name: r[0], value: r[1] };
                });
            }
            let containerWidth = this.down('#grid-area').getWidth() || this.down('#chart-area').getWidth();

            items.push({
                title: 'Summary',
                layout: {
                    type: 'hbox',
                    pack: 'center'
                },
                items: [{
                    xtype: 'rallygrid',
                    itemId: 'summaryGrid',
                    store: Ext.create('Rally.data.custom.Store', {
                        data: data,
                        pageSize: data.length
                    }),
                    columnCfgs: cols,
                    sortableColumns: false,
                    showRowActionsColumn: false,
                    showPagingToolbar: false,
                    enableEditing: false,
                    height: this.down('#grid-area').getHeight() - 20,
                    width: stackField ? containerWidth > 800 ? 800 : containerWidth : containerWidth > 650 ? 650 : containerWidth,
                    // flex: 1,
                    overflowY: 'auto'
                }]
            });
        }

        if (store) {
            let columns = ['FormattedID', 'Name'];

            if (isFeatureFieldForStory) {
                columns.push({
                    text: aggregationDisplayName,
                    // xtype: 'templatecolumn',
                    // tpl: `{${aggregationField}}`
                    dataIndex: 'Feature',
                    renderer: function (value) {
                        return CustomAgile.ui.renderer.RecordFieldRendererFactory.getFieldDisplayValue(value, aggregationField, '; ', true)
                    }
                });
            }
            else {
                columns.push(aggregationField);
            }

            if (aggregationType !== 'count') {
                columns.push(aggregationTypeField);
            }

            if (stackField) {
                columns.push(stackField);
            }

            items.push({
                title: 'Detailed',
                items: [{
                    xtype: 'rallygrid',
                    itemId: 'detailedGrid',
                    store: store,
                    //     Ext.create('Ext.data.Store', {
                    //     model: this.models[0], // this.getSetting('types') === 'HierarchicalRequirement' && this.getSetting('aggregationLevel') || this.getSetting('types'),
                    //     data: _.map(store.getRange(), function (r) {
                    //         if (isFeatureFieldForStory) {
                    //             r.raw[aggregationField] = r.get('Feature') ? CustomAgile.ui.renderer.RecordFieldRendererFactory.getFieldDisplayValue(r.get('Feature'), aggregationField, '; ', true) || 'None' : 'No Feature';
                    //         }
                    //         return r.raw;
                    //     })
                    // }),
                    columnCfgs: columns,
                    sortableColumns: false, // Sorting the store triggers reloads in the chart and throws errors
                    showRowActionsColumn: false,
                    showPagingToolbar: false,
                    enableEditing: false,
                    height: this.down('#grid-area').getHeight() - 20,
                    flex: 1,
                    overflowY: 'auto'
                }]
            });
        }

        this.grids = this.down('#grid-area').add({
            xtype: 'tabpanel',
            itemId: 'grid-area-tab-panel',
            width: '98%',
            cls: 'blue-tabs',
            minTabWidth: 100,
            height: this.down('#grid-area').getHeight(),
            plain: true,
            autoRender: true,
            items: items,
        });
    },

    onTimeboxScopeChange: function () {
        this.callParent(arguments);
        this._addChart();
    },

    _getChartFetch: function () {
        var field = this.getSetting('aggregationField'),
            aggregationType = this.getSetting('aggregationType'),
            artifactType = this.getSetting('types'),
            level = this.getSetting('aggregationLevel'),
            stackField = this._getStackingSetting(),
            fetch = ['FormattedID', 'Name', field];

        if (artifactType === 'HierarchicalRequirement' && level === 'PortfolioItem/Feature') {
            fetch.push('Feature');
        }

        if (aggregationType !== 'count') {
            fetch.push(ChartUtils.getFieldForAggregationType(aggregationType));
        }
        if (stackField) {
            fetch.push(stackField);
        }

        if (_.contains(fetch, 'Iteration')) {
            fetch.push('StartDate');
        }
        if (_.contains(fetch, 'Release')) {
            fetch.push('ReleaseStartDate');
        }

        return fetch;
    },

    _getChartSort: function () {
        var model = this.models[0],
            field = model.getField(this.getSetting('aggregationField')),
            sorters = [];

        if (field && field.getType() !== 'collection' && field.sortable) {
            sorters.push({
                property: this.getSetting('aggregationField'),
                direction: 'ASC'
            });
        }

        return sorters;
    },

    _getFilters: async function (status) {
        var queries = [],
            timeboxScope = this.getContext().getTimeboxScope();
        if (this.getSetting('query')) {
            var querySetting = this.getSetting('query').replace(/\{user\}/g, this.getContext().getUser()._ref);
            queries.push(Rally.data.QueryFilter.fromQueryString(querySetting));
        }
        if (timeboxScope && _.any(this.models, timeboxScope.isApplicable, timeboxScope)) {
            queries.push(timeboxScope.getQueryFilter());
        }

        var filters = await this.ancestorFilterPlugin.getAllFiltersForType(this.models[0].typePath, true).catch((e) => {
            Rally.ui.notify.Notifier.showError({ message: (e.message || e) });
            status.loadingFailed = true;
        });

        if (filters) {
            queries = queries.concat(filters);
        }

        return queries;
    },

    _export: function () {
        if (this.gridboard) {
            let chart = this.gridboard.getGridOrBoard();

            if (chart && typeof chart.loadedStores === 'object') {
                let csv = [];
                let row = [];
                let records = chart.loadedStores.getRange();
                let isFeatureFieldForStory = this._isFeatureFieldForStoryChart();
                let model = this.models[0];
                let field = model.getField(this.getSetting('aggregationField'));
                if (isFeatureFieldForStory) {
                    field = this.featureModel.getField(this.getSetting('aggregationField'));
                }
                let aggregationType = this.getSetting('aggregationType');
                if (aggregationType !== 'count') {
                    aggregationType = ChartUtils.getFieldForAggregationType(aggregationType);
                }
                else {
                    aggregationType = null;
                }
                let stackField = this._getStackingSetting();

                row.push('ID');
                row.push('Name');

                if (isFeatureFieldForStory) {
                    row.push('Feature');
                }

                row.push(field.displayName || 'Aggregation Field');

                if (aggregationType) {
                    row.push(aggregationType);
                }

                if (stackField) {
                    row.push(stackField);
                }

                csv.push(row.join(','));

                for (let r of records) {
                    row = [];
                    row.push(r.get('FormattedID'));
                    row.push(CustomAgile.ui.renderer.RecordFieldRendererFactory.getFieldDisplayValue(r, 'Name', '; ', true));

                    if (isFeatureFieldForStory) {
                        row.push(CustomAgile.ui.renderer.RecordFieldRendererFactory.getFieldDisplayValue(r, 'Feature', '; ', true));
                        row.push(CustomAgile.ui.renderer.RecordFieldRendererFactory.getFieldDisplayValue(r.get('Feature'), field.name, '; ', true));
                    }
                    else {
                        row.push(CustomAgile.ui.renderer.RecordFieldRendererFactory.getFieldDisplayValue(r, field.name, '; ', true));
                    }

                    if (aggregationType) {
                        row.push(CustomAgile.ui.renderer.RecordFieldRendererFactory.getFieldDisplayValue(r, aggregationType, '; ', true));
                    }

                    if (stackField) {
                        row.push(CustomAgile.ui.renderer.RecordFieldRendererFactory.getFieldDisplayValue(r, stackField, '; ', true));
                    }

                    csv.push(row.join(','));
                }
                csv = csv.join('\r\n');
                let fileName = `custom-chart-export-${Rally.util.DateTime.format(new Date(), 'Y-m-d-h-i-s')}.csv`;
                CustomAgile.utils.Toolbox.saveAs(csv, fileName);
            }
        }
    },

    _isFeatureFieldForStoryChart: function () {
        return this.getSetting('types') === 'HierarchicalRequirement' && this.getSetting('aggregationLevel') === 'PortfolioItem/Feature';
    }
});
