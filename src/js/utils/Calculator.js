Ext.define('Calculator', {

    config: {
        calculationType: undefined,
        field: undefined,
        isFeatureFieldForStoryChart: false,
        featureModel: undefined,
        stackField: undefined,
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

        if (!this.stackField) {
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
                        name: this.field,
                        type: this.seriesType,
                        data: seriesData
                    }
                ]
            };
        } else {
            var stackField = store.model.getField(this.stackField),
                stackValues;

            if (this.stackValues) {
                stackValues = _.map(this.stackValues, function (stackValue) {
                    return this._getDisplayValue(stackField, stackValue);
                }, this);
            } else {
                var values = _.invoke(store.getRange(), 'get', this.stackField);
                if (this.stackField === 'Iteration' || this.stackField === 'Release') {
                    values = _.sortBy(values, function (timebox) {
                        var dateValue = timebox && (timebox.StartDate || timebox.ReleaseStartDate || null);
                        return new Date(dateValue);
                    });
                }
                stackValues = _.unique(_.map(values, function (value) {
                    return this._getDisplayValue(stackField, value);
                }, this));
            }

            var series = {};
            _.each(categories, function (category) {
                var group = data[category];
                var recordsByStackValue = _.groupBy(group, function (record) {
                    return this._getDisplayValueForField(record, this.stackField, false);
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
                var value = this.isFeatureFieldForStoryChart ? record.get('Feature') && record.get('Feature')[this.field] || {} : record.get(this.field);
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
                return this._getDisplayValueForField(record, this.field, true);
            }, this);
            if (fieldType === 'date') {
                var dates = _.sortBy(_.compact(_.map(store.getRange(), function (record) {
                    return this.isFeatureFieldForStoryChart ? record.get('Feature') && record.get('Feature')[this.field] && Rally.util.DateTime.fromIsoString(record.get('Feature')[this.field]) : record.get(this.field);
                }, this)));
                var datesNoGaps = this._getDateRange(dates[0], dates[dates.length - 1]);
                var allGroups = {};
                if (groups['-- No Entry --']) {
                    allGroups['-- No Entry --'] = groups['-- No Entry --'];
                }
                groups = _.reduce(datesNoGaps, function (accum, val) {
                    var group = this._getDisplayValue(field, moment(val).toDate());
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

    _getDisplayValueForField: function (record, fieldName, isGrouping) {
        if (this.isFeatureFieldForStoryChart && isGrouping && !record.get('Feature')) {
            return 'No Feature';
        }

        var field = this.isFeatureFieldForStoryChart && isGrouping ? this.featureModel && this.featureModel.getField(fieldName) : record.getField(fieldName),
            value = this.isFeatureFieldForStoryChart && isGrouping ? record.get('Feature')[fieldName] : record.get(fieldName);

        if (field.getType() === 'date' && value && typeof value === 'string') {
            value = Rally.util.DateTime.fromIsoString(value);
        }

        return this._getDisplayValue(field, value);
    },

    _getDisplayValue: function (field, value) {
        if (!field) {
            return 'Field not groupable';
        } else if (_.isDate(value)) {
            if (!this.bucketBy || this.bucketBy === 'day') {
                return Rally.util.DateTime.formatWithDefault(value);
            } else if (this.bucketBy === 'week') {
                return Rally.util.DateTime.formatWithDefault(moment(value).startOf('week').toDate());
            } else if (this.bucketBy === 'month') {
                return moment(value).startOf('month').format('MMM \'YY');
            } else if (this.bucketBy === 'quarter') {
                return moment(value).startOf('quarter').format('YYYY [Q]Q');
            } else if (this.bucketBy === 'year') {
                return moment(value).startOf('year').format('YYYY');
            }
        } else if (_.isObject(value)) {
            return value._refObjectName || value._ref;
        } else if (Ext.isEmpty(value)) {
            var fieldType = field.getType();
            if (field.attributeDefinition.SchemaType === 'User') {
                return '-- No Owner --';
            } else if (fieldType === 'rating' || fieldType === 'object') {
                return 'None';
            } else {
                return '-- No Entry --';
            }
        } else if (field.name === 'DisplayColor') {
            let color = CustomAgile.ui.renderer.RecordFieldRendererFactory.colorPalette[value];
            return color ? color : value;
        } else {
            return value;
        }
    },

    _getField: function (store) {
        if (this.isFeatureFieldForStoryChart) {
            return this.featureModel && this.featureModel.getField(this.field);
        }
        else {
            return store.model.getField(this.field)
        }
    },

    _getValueFieldForCalculationType: function () {
        return ChartUtils.getFieldForAggregationType(this.calculationType);
    }
});
