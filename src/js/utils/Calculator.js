Ext.define('Calculator', {

    config: {
        calculationType: undefined,
        fieldName: undefined,
        isFeatureFieldForStoryChart: false,
        featureModel: undefined,
        stackFieldName: undefined,
        stackValues: undefined,
        bucketBy: undefined
    },

    constructor: function (config) {
        this.initConfig(config);
    },

    prepareChartData: function (store) {
        var data = this._groupData(store),
            categories = _.keys(data),
            seriesData;

        if (!this.stackFieldName) {
            if (this.calculationType === 'count') {
                seriesData = _.map(data, function (value, key) {
                    return [key, value.length];
                });
            } else {
                seriesData = _.map(data, function (value, key) {
                    var valueTotal = _.reduce(value, function (total, r) {
                        var valueField = this._getValueFieldForCalculationType();
                        return total + r.get(valueField);
                    }, 0, this);
                    if (value && value.length && (this.calculationType === 'percentdonebystorycount' || this.calculationType === 'percentdonebystoryplanestimate')) {
                        valueTotal = Math.round(valueTotal / value.length * 100);
                    }
                    return [key, valueTotal];
                }, this);
            }

            return {
                categories: categories,
                series: [
                    {
                        name: this.fieldName,
                        type: this.seriesType,
                        data: seriesData
                    }
                ]
            };
        } else {
            var stackField = store.model.getField(this.stackFieldName),
                stackValues;

            if (this.stackValues) {
                stackValues = _.map(this.stackValues, function (stackValue) {
                    return CustomAgile.ui.renderer.ChartFieldRenderer.getDisplayValue(stackField, stackValue, this.bucketBy);
                }, this);
            } else {
                stackValues = _.unique(_.map(store.getRange(), function (r) {
                    return r.get('StackFieldValue');
                }, this));
            }

            var series = {};
            _.each(categories, function (category) {
                var group = data[category];
                var recordsByStackValue = _.groupBy(group, function (r) {
                    return r.get('StackFieldValue');
                }, this);
                _.each(stackValues, function (stackValue) {
                    series[stackValue] = series[stackValue] || [];
                    var records = recordsByStackValue[stackValue];

                    if (this.calculationType === 'count') {
                        series[stackValue].push((records && records.length) || 0);
                    } else {
                        var valueTotal = _.reduce(records, function (total, r) {
                            var valueField = this._getValueFieldForCalculationType();
                            return total + r.get(valueField);
                        }, 0, this);
                        if (records && records.length && (this.calculationType === 'percentdonebystorycount' || this.calculationType === 'percentdonebystoryplanestimate')) {
                            valueTotal = Math.round(valueTotal / records.length * 100);
                        }
                        series[stackValue].push(valueTotal);
                    }
                }, this);
            }, this);

            return {
                categories: categories,
                series: _.map(stackValues, function (value) {
                    return {
                        name: value,
                        type: this.seriesType,
                        data: series[value]
                    };
                }, this)
            };
        }
    },

    _groupData: function (store) {
        var field = this._getField(store);
        var fieldType = field && field.getType() || '';
        var groups = {};

        if (fieldType === 'collection') {
            _.each(store.getRange(), function (record) {
                var value = this.isFeatureFieldForStoryChart ? record.get('Feature') && record.get('Feature')[this.fieldName] || {} : record.get(this.fieldName);
                var values = value._tagsNameArray;
                if (_.isEmpty(values)) {
                    groups.None = groups.None || [];
                    groups.None.push(record);
                } else {
                    _.each(values, function (val) {
                        groups[val.Name] = groups[val.Name] || [];
                        groups[val.Name].push(record);
                    });
                }
            }, this);
            return groups;
        } else {
            groups = _.groupBy(store.getRange(), function (record) {
                if (this.isFeatureFieldForStoryChart && !record.get('Feature')) {
                    return 'No Feature';
                }
                return record.get('AggregationFieldValue');
            }, this);
            if (fieldType === 'date') {
                var dates = _.sortBy(_.compact(_.map(store.getRange(), function (record) {
                    return this.isFeatureFieldForStoryChart ? record.get('Feature') && record.get('Feature')[this.fieldName] && Rally.util.DateTime.fromIsoString(record.get('Feature')[this.fieldName]) : record.get(this.fieldName);
                }, this)));
                var datesNoGaps = this._getDateRange(dates[0], dates[dates.length - 1]);
                var allGroups = {};
                if (groups['-- No Entry --']) {
                    allGroups['-- No Entry --'] = groups['-- No Entry --'];
                }
                groups = _.reduce(datesNoGaps, function (accum, val) {
                    var group = CustomAgile.ui.renderer.ChartFieldRenderer.getDisplayValue(field, moment(val).toDate(), this.bucketBy);
                    accum[group] = groups[group] || [];
                    return accum;
                }, allGroups, this);
            }

            return groups;
        }
    },

    _getDateRange: function (startDate, endDate) {
        var currentDate = startDate;
        var datesNoGaps = [];
        var unit = 'd';
        if (this.bucketBy === 'week') {
            unit = 'w';
        } else if (this.bucketBy === 'month') {
            unit = 'M';
        } else if (this.bucketBy === 'quarter') {
            unit = 'Q';
        } else if (this.bucketBy === 'year') {
            unit = 'y';
        }

        while (currentDate <= endDate) {
            datesNoGaps.push(currentDate);
            currentDate = moment(currentDate).add(1, unit).toDate();
        }

        datesNoGaps.push(endDate);
        return datesNoGaps;
    },

    _getField: function (store) {
        if (this.isFeatureFieldForStoryChart) {
            return this.featureModel && this.featureModel.getField(this.fieldName);
        }
        else {
            return store.model.getField(this.fieldName)
        }
    },

    _getValueFieldForCalculationType: function () {
        return ChartUtils.getFieldForAggregationType(this.calculationType);
    }
});
