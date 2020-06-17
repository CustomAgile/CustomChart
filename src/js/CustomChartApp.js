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
            this.down('#grid-area').on('resize', this.onGridAreaResize, this);
            this.down('#filter-area').on('resize', this.onGridAreaResize, this);

            this.ancestorFilterPlugin = Ext.create('Utils.AncestorPiAppFilter', {
                ptype: 'UtilsAncestorPiAppFilter',
                pluginId: 'ancestorFilterPlugin',
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
                                this.addButtons();

                                if (this.down('#chart-area').getHeight() < 260) {
                                    this.down('#grid-area').setHeight((this.down('#grid-area').getHeight() + this.down('#chart-area').getHeight()) / 2)
                                }

                                this._addChart();
                            }
                        });
                    },
                }
            });
            this.addPlugin(this.ancestorFilterPlugin);
        }
    },

    addButtons: function () {
        let renderArea = this.down('#' + Utils.AncestorPiAppFilter.RENDER_AREA_ID);
        let buttonArea = renderArea;
        let margins = '0 10 0 0';
        if (renderArea.getWidth() < 740 && this.ancestorFilterPlugin._showIgnoreProjectScopeControl()) {
            buttonArea = Ext.widget('container', {
                id: 'extended-button-area',
                margin: '5 0 4 0',
                layout: {
                    type: 'hbox',
                    pack: 'start',
                }
            });
            margins = '0 0 0 20';
            this.down('#filter-area').insert(1, buttonArea);
            if (this.down('multifiltertogglebtn')) {
                buttonArea.insert(0, this.down('multifiltertogglebtn'));
            }
        }
        this.addToggleBtn(buttonArea, margins);
        this.addFieldPickerBtn(buttonArea, margins);
        this.addExportBtn(buttonArea, margins);
    },

    addExportBtn: function (buttonArea, margins) {
        buttonArea.add({
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
            margin: margins,
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

    addFieldPickerBtn: function (buttonArea, margins) {
        let modelName = this.models[0].typePath;
        let context = this.getContext();
        let alwaysSelectedValues = [];
        let stackField = this._getStackingSetting();
        let aggregationType = this.getSetting('aggregationType');

        if (!this._isFeatureFieldForStoryChart()) {
            let aggregationField = this.models[0].getField(this.getSetting('aggregationField'));
            if (aggregationField) {
                alwaysSelectedValues.push(aggregationField.name);
            }
        }
        if (aggregationType !== 'count') {
            alwaysSelectedValues.push(ChartUtils.getFieldForAggregationType(aggregationType));
        }
        if (stackField) {
            alwaysSelectedValues.push(stackField);
        }

        buttonArea.add({
            xtype: 'tsfieldpickerbutton',
            margin: margins,
            toolTipConfig: {
                html: 'Additional Columns for Grid & Export',
                anchor: 'top'
            },
            getTitle: function () {
                return 'Additional Columns';
            },
            modelNames: [modelName],
            _fields: [],
            context: context,
            stateful: true,
            stateId: context.getScopedStateId(modelName + 'fields'), // columns specific to type of object
            alwaysSelectedValues: alwaysSelectedValues,
            listeners: {
                fieldsupdated: function () {
                    this._addChart();
                },
                scope: this
            }
        });
    },

    getFieldsFromButton: function () {
        var fieldPicker = this.down('tsfieldpickerbutton');
        var result = [];
        if (fieldPicker) {
            result = fieldPicker.getFields();
        }
        return result;
    },

    addToggleBtn: function (buttonArea, margins) {
        buttonArea.add({
            xtype: 'chartgridtogglebtn',
            itemId: 'chartGridToggleBtn',
            toggleState: 'chart',
            margin: margins,
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

        this.models = [models[this.getSetting('types')]];
        this.featureModel = models['PortfolioItem/Feature'];
        this.setChartVariables();

        if (this._shouldLoadAllowedStackValues(this.stackField)) {
            result = this.stackField.getAllowedValueStore().load().then({
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
        this.down('#grid-area').removeAll();
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

            let modelNames = _.pluck(this.models, 'typePath');
            let gridBoardConfig = {
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

    setChartVariables: function () {
        this.artifactType = this.getSetting('types');
        this.isFeatureFieldForStory = this._isFeatureFieldForStoryChart();
        this.aggregationType = this.getSetting('aggregationType');
        this.aggregationTypeFieldName = ChartUtils.getFieldForAggregationType(this.aggregationType);
        this.aggregationFieldName = this.getSetting('aggregationField');
        this.aggregationField = this.isFeatureFieldForStory ? this.featureModel && this.featureModel.getField(this.aggregationFieldName) : this.models[0] && this.models[0].getField(this.aggregationFieldName);
        this.aggregationFieldDisplayName = ((this.aggregationField && this.aggregationField.displayName) || aggregationFieldName) + (this.isFeatureFieldForStory ? ' (Feature)' : '');
        this.aggregationLevel = this.getSetting('aggregationLevel');
        this.stackFieldName = this._getStackingSetting();
        this.stackField = this.stackFieldName && this.models[0] && this.models[0].getField(this.stackFieldName);
        this.stackFieldDisplayName = this.stackFieldName ? ((this.stackField && this.stackField.displayName) || this.stackFieldName) : '';
        this.bucketBy = this.getSetting('bucketBy');
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
        let chartType = this.getSetting('chartType');
        let config = {
            xtype: chartType,
            enableStacking: !!this.stackFieldName,
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
                remoteSort: false,
                pageSize: 2000,
                enablePostGet: true,
                listeners: {
                    scope: this,
                    load: function (store, records, successful) {
                        if (records.length === 10000) {
                            Rally.ui.notify.Notifier.showWarning({ message: 'Results limited to 10,000 to avoid timeouts' });
                        }

                        if (!successful) {
                            this._showError('Failed to load data, most likely caused by a server timeout. Try adjusting your scope or filters to reduce the amount of data returned.');
                        }
                        else {
                            let setParent = this.artifactType === 'HierarchicalRequirement' && ((!this.isFeatureFieldForStory && this.aggregationFieldName === 'Parent') || this.stackFieldName === 'Parent' || _.contains(this.getFieldsFromButton(), 'Parent'));
                            for (let r of records) {
                                if (setParent && !r.get('Parent')) {
                                    r.set('Parent', r.get('Feature'));
                                }

                                let rec = this.isFeatureFieldForStory ? r.get('Feature') : r;

                                if (this.isFeatureFieldForStory && !rec) {
                                    r.set('AggregationFieldValue', 'No Feature');
                                }
                                else {
                                    r.set('AggregationFieldValue', CustomAgile.ui.renderer.ChartFieldRenderer.getDisplayValueForField(rec, this.aggregationFieldName, this.aggregationField, this.bucketBy));
                                }

                                if (this.stackField) {
                                    r.set('StackFieldValue', CustomAgile.ui.renderer.ChartFieldRenderer.getDisplayValueForField(r, this.stackFieldName, this.stackField, this.bucketBy));
                                }
                            }

                        }
                    }
                }
            },
            calculatorConfig: {
                calculationType: this.aggregationType,
                fieldName: this.aggregationFieldName,
                isFeatureFieldForStoryChart: this.isFeatureFieldForStory,
                featureModel: this.featureModel,
                stackFieldName: this.stackFieldName,
                stackValues: this.stackValues,
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

        if (this.models[0].isArtifact()) {
            config.storeConfig.models = [this.getSetting('types')];
            config.storeType = 'Rally.data.wsapi.artifact.Store';
        }
        else {
            config.storeConfig.model = this.models[0];
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
        this.records = store && store.getRange() || [];
        let items = [];

        if (chart.chartData) {
            let data = [];
            let cols = [];

            if (this.stackFieldName) {
                let categories = chart.chartData.categories;
                cols = [
                    {
                        text: this.aggregationFieldDisplayName,
                        dataIndex: 'name',
                        flex: 3,
                        renderer: function (value, metaData, record) {
                            if (!record.raw.isPrimaryRow) {
                                return '';
                            }
                            return value;
                        }
                    },
                    {
                        text: this.stackFieldDisplayName,
                        dataIndex: 'stackField',
                        flex: 3,
                        doSort: function (state) {
                            this.up('grid').getStore().sort({
                                direction: state,
                                sorterFn: function (v1, v2) {
                                    if (v1.raw.name !== v2.raw.name) {
                                        return 0;
                                    }
                                    if (v1.raw.isPrimaryRow) {
                                        return this.direction === 'ASC' ? -1 : 1;
                                    }
                                    if (v2.raw.isPrimaryRow) {
                                        return this.direction === 'ASC' ? 1 : -1;
                                    }
                                    v1 = v1.raw.stackField;
                                    v2 = v2.raw.stackField;

                                    return v1.localeCompare(v2);
                                }
                            });
                        }
                    },
                    {
                        text: this.aggregationType === 'count' ? 'Count' : this.aggregationTypeFieldName,
                        dataIndex: 'value',
                        flex: 1,
                        doSort: function (state) {
                            this.up('grid').getStore().sort([{
                                direction: state,
                                sorterFn: function (v1, v2) {
                                    let val1 = v1.raw.totalValue;
                                    let val2 = v2.raw.totalValue;

                                    return val1 < val2 ? -1 : val1 === val2 ? 0 : 1;
                                }
                            }, {
                                // property: 'Feature',
                                direction: state,
                                sorterFn: function (v1, v2) {
                                    let val1 = v1.raw.value;
                                    let val2 = v2.raw.value;

                                    if (v1.raw.name !== v2.raw.name) {
                                        return 0;
                                    }
                                    if (v1.raw.isPrimaryRow) {
                                        return this.direction === 'ASC' ? -1 : 1;
                                    }
                                    if (v2.raw.isPrimaryRow) {
                                        return this.direction === 'ASC' ? 1 : -1;
                                    }

                                    return val1 < val2 ? -1 : val1 === val2 ? 0 : 1;
                                }
                            }]);
                        },
                        renderer: function (value, metaData, record) {
                            return `<a onclick="Rally.getApp()._getOnClick(event,'${record.get('name').replace(/"/g, '\\"').replace(/'/g, "\\'")}','${record.get('stackField').replace(/"/g, '\\"').replace(/'/g, "\\'")}'); return false;">
                                        <span class="summary-grid-value">${value}</span>
                                    </a>`;
                        },
                    }
                ];

                let dataLookup = {};

                for (let r of this.records) {
                    dataLookup[(r.get('AggregationFieldValue') || '') + (r.get('StackFieldValue') || '')] = 1
                }

                for (let i = 0; i < categories.length; i++) {
                    let c = categories[i];
                    let secondaryRows = [];

                    let primaryRow = {
                        name: c,
                        stackField: '',
                        value: 0,
                        isPrimaryRow: true
                    }

                    for (let s of chart.chartData.series) {
                        let val = s.data[i];

                        if (typeof val === 'number' && (val || (this.aggregationType !== 'count' && dataLookup[c + s.name]))) {
                            primaryRow.value += val;

                            secondaryRows.push({
                                name: c,
                                stackField: s.name,
                                value: val,
                                isPrimaryRow: false
                            });
                        }
                    }

                    primaryRow.totalValue = primaryRow.value;

                    for (let r of secondaryRows) {
                        r.totalValue = primaryRow.value;
                    }

                    data = data.concat([primaryRow].concat(secondaryRows));
                }
            }
            else {
                let series = (chart.chartData && chart.chartData.series.length && chart.chartData.series[0]) || [];

                cols = [
                    { text: this.aggregationFieldDisplayName, dataIndex: 'name', flex: 3 },
                    {
                        text: this.aggregationType === 'count' ? 'Count' : this.aggregationTypeFieldName,
                        dataIndex: 'value',
                        flex: 1,
                        renderer: function (value, metaData, record) {
                            return `<a onclick="Rally.getApp()._getOnClick(event,'${record.get('name').replace(/"/g, '\\"').replace(/'/g, "\\'")}',''); return false;">
                                        <span class="summary-grid-value">${value}</span>
                                    </a>`;
                        },
                    }
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
                    showRowActionsColumn: false,
                    showPagingToolbar: false,
                    enableEditing: false,
                    height: this.down('#grid-area').getHeight() - 20,
                    width: this.stackFieldName ? containerWidth > 800 ? 800 : containerWidth : containerWidth > 650 ? 650 : containerWidth,
                    overflowY: 'auto'
                }]
            });
        }

        if (store) {
            let columns = this.getDetailedGridColumns();

            items.push({
                title: 'Detailed',
                items: [{
                    xtype: 'rallygrid',
                    itemId: 'detailedGrid',
                    store: store,
                    columnCfgs: columns,
                    sortableColumns: true,
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
            TabWidth: 100,
            height: this.down('#grid-area').getHeight(),
            plain: true,
            autoRender: true,
            items: items,
        });
    },

    getDetailedGridColumns: function () {
        let columns = ['FormattedID', 'Name'];

        if (this.isFeatureFieldForStory) {
            columns.push({
                text: this.aggregationFieldDisplayName,
                dataIndex: 'Feature',
                renderer: function (value, metaData, record) {
                    return record.get('AggregationFieldValue');
                },
                doSort: function (state) {
                    this.up('grid').getStore().sort({
                        property: 'Feature',
                        direction: state,
                        sorterFn: function (v1, v2) {
                            v1 = v1.get('AggregationFieldValue');
                            v2 = v2.get('AggregationFieldValue');

                            return v1.localeCompare(v2);
                        }
                    });
                },
            });
        }
        else {
            columns.push(this.aggregationFieldName);
        }

        if (this.aggregationType !== 'count') {
            columns.push(this.aggregationTypeFieldName);
        }

        if (this.stackFieldName) {
            columns.push(this.stackFieldName);
        }

        columns = _.union(columns, this.getFieldsFromButton());
        return columns;
    },

    _getOnClick(event, fieldNameVal, stackFieldNameVal) {
        if (this.records) {
            let data = _.filter(this.records, function (r) {
                if (stackFieldNameVal) {
                    return stackFieldNameVal === r.get('StackFieldValue') && fieldNameVal === r.get('AggregationFieldValue');
                }

                return fieldNameVal === r.get('AggregationFieldValue');
            }, this);

            Ext.create(CustomAgile.ui.popover.SummaryGridPopover, {
                target: event.target,
                placement: ['bottom', 'top'],
                offsetFromTarget: [
                    { x: 0, y: -5 },
                    { x: 5, y: 0 },
                    { x: 0, y: 5 },
                    { x: -5, y: 0 }
                ],
                models: this.models,
                data: data,
                maxWidth: this.down('#grid-area').getWidth(),
                columns: this.getDetailedGridColumns()
            });

            return false;
        }
    },

    onTimeboxScopeChange: function () {
        this.callParent(arguments);
        this._addChart();
    },

    _getChartFetch: function () {
        var field = this.getSetting('aggregationField'),
            fetch = ['FormattedID', 'Name', field];

        if (this.artifactType === 'HierarchicalRequirement' && this.aggregationLevel === 'PortfolioItem/Feature') {
            fetch.push('Feature');
        }

        if (this.aggregationTypeFieldName) {
            fetch.push(this.aggregationTypeFieldName);
        }
        if (this.stackFieldName) {
            fetch.push(this.stackFieldName);
        }

        if (_.contains(fetch, 'Iteration')) {
            fetch.push('StartDate');
        }
        if (_.contains(fetch, 'Release')) {
            fetch.push('ReleaseStartDate');
        }

        fetch = fetch.concat(this.getFieldsFromButton());

        if (_.contains(fetch, 'PredecessorsAndSuccessors')) {
            fetch.push('Predecessors');
            fetch.push('Successors');
        }

        if (this.artifactType === 'HierarchicalRequirement' && _.contains(fetch, 'Parent') && !_.contains(fetch, 'Feature')) {
            fetch.push('Feature');
        }

        return fetch;
    },

    _getChartSort: function () {
        var sorters = [];

        if (this.aggregationField && this.aggregationField.getType() !== 'collection' && this.aggregationField.sortable) {
            sorters.push({
                property: this.aggregationFieldName,
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
            this._showError(e, 'Failed while loading filters');
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
                let additionalFields = this.getFieldsFromButton();

                row.push('ID');
                row.push('Name');

                if (this.isFeatureFieldForStory) {
                    row.push('Feature');
                }

                row.push((this.aggregationField && this.aggregationField.displayName) || 'Aggregation Field');

                if (this.aggregationType !== 'count') {
                    row.push(this.aggregationTypeFieldName);
                }

                if (this.stackFieldName) {
                    row.push(this.stackFieldDisplayName);
                }

                row = _.union(row, additionalFields);
                csv.push(row);

                let fields = _.clone(row);
                fields[0] = 'FormattedID';

                if (this.isFeatureFieldForStory) {
                    fields[3] = 'AggregationField';
                }
                else {
                    fields[2] = (this.aggregationField && this.aggregationField.name) || '';
                }

                for (let r of records) {
                    let row = [];

                    for (let f of fields) {
                        if (f === 'AggregationField' && this.isFeatureFieldForStory) {
                            continue;
                        }

                        if (f === 'Feature' && this.isFeatureFieldForStory) {
                            row.push(CustomAgile.ui.renderer.RecordFieldRendererFactory.getFieldDisplayValue(r, 'Feature', '; ', true));
                            row.push(CustomAgile.ui.renderer.RecordFieldRendererFactory.getFieldDisplayValue(r.get('Feature'), this.aggregationField.name, '; ', true));
                        }
                        else {
                            row.push(CustomAgile.ui.renderer.RecordFieldRendererFactory.getFieldDisplayValue(r, f, '; ', true));
                        }
                    }
                    csv.push(row);
                }
                csv = Papa.unparse(csv);

                let fileName = `custom-chart-export-${Rally.util.DateTime.format(new Date(), 'Y-m-d-h-i-s')}.csv`;
                CustomAgile.utils.Toolbox.saveAs(csv, fileName);
                return;
            }
        }
        this._showError('Unable to load chart data for export');
    },

    _isFeatureFieldForStoryChart: function () {
        return this.getSetting('types') === 'HierarchicalRequirement' && this.getSetting('aggregationLevel') === 'PortfolioItem/Feature';
    },

    _showError(msg, defaultMessage) {
        Rally.ui.notify.Notifier.showError({ message: this.parseError(msg, defaultMessage) });
    },

    parseError(e, defaultMessage) {
        defaultMessage = defaultMessage || 'An unknown error has occurred';

        if (typeof e === 'string' && e.length) {
            return e;
        }
        if (e.message && e.message.length) {
            return e.message;
        }
        if (e.exception && e.error && e.error.errors && e.error.errors.length) {
            if (e.error.errors[0].length) {
                return e.error.errors[0];
            } else {
                if (e.error && e.error.response && e.error.response.status) {
                    return `${defaultMessage} (Status ${e.error.response.status})`;
                }
            }
        }
        if (e.exceptions && e.exceptions.length && e.exceptions[0].error) {
            return e.exceptions[0].error.statusText;
        }
        return defaultMessage;
    },
});
