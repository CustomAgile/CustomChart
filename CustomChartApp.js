Ext.define('CustomChartApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    layout: {
        type: 'vbox',
        align: 'stretch'
    },

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
    }, {
        id: 'grid-area',
        itemId: 'grid-area',
        xtype: 'container',
        flex: 1,
        overflowY: 'auto',
        type: 'vbox',
        align: 'stretch',
    }],
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
                                this._addChart();
                            }
                        });
                    },
                }
            });
            this.addPlugin(this.ancestorFilterPlugin);
        }
    },

    // Usual monkey business to size gridboards
    onResize: function () {
        this.callParent(arguments);
        var gridArea = this.down('#grid-area');
        var gridboard = this.down('rallygridboard');
        if (gridArea && gridboard) {
            gridboard.setHeight(gridArea.getHeight());
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

        var gridArea = this.down('#grid-area');
        gridArea.removeAll();
        gridArea.setLoading(true);

        var context = this.getContext();
        var dataContext = context.getDataContext();
        if (this.searchAllProjects()) {
            dataContext.project = null;
        }
        this._getFilters(thisStatus).then((filters) => {

            if (thisStatus.loadingFailed) {
                gridArea.setLoading(false);
                return;
            }

            if (thisStatus.cancelLoad) {
                return;
            }

            var modelNames = _.pluck(this.models, 'typePath'),
                gridBoardConfig = {
                    xtype: 'rallygridboard',
                    toggleState: 'chart',
                    height: gridArea.getHeight(),
                    chartConfig: this._getChartConfig(),
                    plugins: [{
                        ptype: 'rallygridboardactionsmenu',
                        menuItems: [{
                            text: 'Export to CSV...',
                            handler: this._export,
                            scope: this
                        }],
                        buttonConfig: {
                            iconCls: 'icon-export',
                            toolTipConfig: {
                                html: 'Export',
                                anchor: 'top',
                                hideDelay: 0
                            }
                        }
                    }],
                    context: context,
                    modelNames: modelNames,
                    storeConfig: {
                        filters: filters,
                        context: dataContext,
                        enablePostGet: true
                    }
                };

            this.gridboard = gridArea.add(gridBoardConfig);
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
                // chartConfig: {
                //     legend: {
                //         floating: true,
                //         enabled: true,
                //         labelFormat: '{name} {data}'
                //     },
                // },
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
                        this.down('#grid-area').setLoading(false);
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
