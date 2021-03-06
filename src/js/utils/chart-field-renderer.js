/**
 *      Given a record and a field, return a user-friendly string representation
 */
Ext.define('CustomAgile.ui.renderer.ChartFieldRenderer', {
    singleton: true,

    getDisplayValueForField: function (record, fieldName, field, bucketBy) {
        let val = record.get ? record.get(fieldName) : record[fieldName];

        if (_.isDate(val) || Ext.isEmpty(val, false)) {
            return this.getDisplayValue(field, val, bucketBy);
        }
        return CustomAgile.ui.renderer.RecordFieldRendererFactory.getFieldDisplayValue(record, fieldName, '; ', false) || 'None';
    },

    getDisplayValue: function (field, value, bucketBy) {
        if (!field) {
            return 'Field not groupable';
        } else if (_.isDate(value)) {
            if (!bucketBy || bucketBy === 'day') {
                return Rally.util.DateTime.formatWithDefault(value);
            } else if (bucketBy === 'week') {
                return Rally.util.DateTime.formatWithDefault(moment(value).startOf('week').toDate());
            } else if (bucketBy === 'month') {
                return moment(value).startOf('month').format('MMM \'YY');
            } else if (bucketBy === 'quarter') {
                return moment(value).startOf('quarter').format('YYYY [Q]Q');
            } else if (bucketBy === 'year') {
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
});