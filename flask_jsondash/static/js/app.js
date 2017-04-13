/** global: d3 */
/**
 * Bootstrapping functions, event handling, etc... for application.
 */

var jsondash = function() {
    var my = {
        chart_wall: null,
        widgets: {},
    };
    var dashboard_data   = null;
    var API_ROUTE_URL    = $('[name="dataSource"]');
    var API_PREVIEW      = $('#api-output');
    var API_PREVIEW_BTN  = $('#api-output-preview');
    var API_PREVIEW_CONT = $('.api-preview-container');
    var MODULE_FORM      = $('#module-form');
    var VIEW_BUILDER     = $('#view-builder');
    var ADD_MODULE       = $('#add-module');
    var MAIN_CONTAINER   = $('#container');
    var EDIT_MODAL       = $('#chart-options');
    var DELETE_BTN       = $('#delete-widget');
    var DELETE_DASHBOARD = $('.delete-dashboard');
    var SAVE_MODULE      = $('#save-module');
    var EDIT_CONTAINER   = $('#edit-view-container');
    var MAIN_FORM        = $('#save-view-form');
    var JSON_DATA        = $('#raw-config');
    var ADD_ROW_CONTS    = $('.add-new-row-container');
    var EDIT_TOGGLE_BTN  = $('[href=".edit-mode-component"]');
    var UPDATE_FORM_BTN  = $('#update-module');
    var CHART_TEMPLATE   = $('#chart-template');
    var ROW_TEMPLATE     = $('#row-template').find('.grid-row');

    function addWidget(container, config) {
        if(document.querySelector('[data-guid="' + config.guid + '"]')) return d3.select('[data-guid="' + config.guid + '"]');
        return d3.select(container).select('div')
            .append('div')
            .classed({item: true, widget: true})
            .attr('data-guid', config.guid)
            .attr('data-refresh', config.refresh)
            .attr('data-refresh-interval', config.refreshInterval)
            .style('width', config.width + 'px')
            .style('height', config.height + 'px')
            .html(d3.select(CHART_TEMPLATE.selector).html())
            .select('.widget-title .widget-title-text').text(config.name);
    }

    function getFormConfig() {
        return jsondash.util.serializeToJSON(MODULE_FORM.serializeArray());
    }

    function togglePreviewOutput(is_on) {
        if(is_on) {
            API_PREVIEW_CONT.show();
            return;
        }
        API_PREVIEW_CONT.hide();
    }

    function previewAPIRoute(e) {
        e.preventDefault();
        // Shows the response of the API field as a json payload, inline.
        $.ajax({
            type: 'get',
            url: API_ROUTE_URL.val().trim(),
            success: function(data) {
                API_PREVIEW.html(prettyCode(data));
            },
            error: function(data, status, error) {
                API_PREVIEW.html(error);
            }
        });
    }

    function refreshableType(type) {
        if(type === 'youtube') {return false;}
        return true;
    }

    function saveModule(e){
        var config   = getFormConfig();
        var newfield = $('<input class="form-control" type="text">');
        var id       = jsondash.util.guid();
        // Add a unique guid for referencing later.
        config['guid'] = id;
        // Add family for lookups
        config['family'] = MODULE_FORM.find('[name="type"]').find('option:selected').data().family;
        if(!config.refresh || !refreshableType(config.type)) {config['refresh'] = false;}
        if(!config.override) {config['override'] = false;}
        newfield.attr('name', 'module_' + id);
        newfield.val(JSON.stringify(config));
        $('.modules').append(newfield);
        // Save immediately.
        MAIN_FORM.submit();
    }

    function isModalButton(e) {
        return e.relatedTarget.id === ADD_MODULE.selector.replace('#', '');
    }

    function isRowButton(e) {
        return $(e.relatedTarget).hasClass('grid-row-label');
    }

    function clearForm() {
        MODULE_FORM.find('input').each(function(_, input){
            $(input).val('');
        });
    }

    function updateEditForm(e) {
        // If the modal caller was the add modal button, skip populating the field.
        API_PREVIEW.text('...');
        if(isModalButton(e) || isRowButton(e)) {
            clearForm();
            DELETE_BTN.hide();
            if(isRowButton(e)) {
                var row = $(e.relatedTarget).data().row;
                populateRowField(row);
            }
            return;
        }
        DELETE_BTN.show();
        // Updates the fields in the edit form to the active widgets values.
        var item = $(e.relatedTarget).closest('.item.widget');
        var guid = item.data().guid;
        var module = getModule(item);
        populateRowField(module.row);
        // Update the modal window fields with this one's value.
        $.each(module, function(field, val){
            if(field === 'override' || field === 'refresh') {
                MODULE_FORM.find('[name="' + field + '"]').prop('checked', val);
            } else {
                MODULE_FORM.find('[name="' + field + '"]').val(val);
            }
        });
        // Update with current guid for referencing the module.
        MODULE_FORM.attr('data-guid', guid);
        populateOrderField(module);
        // Update form for specific row if row button was caller
        // Trigger event for select dropdown to ensure any UI is consistent.
        // This is done AFTER the fields have been pre-populated.
        MODULE_FORM.find('[name="type"]').change();
    }

    function populateRowField(row) {
        var rows_field = $('[name="row"]');
        var num_rows = $('.grid-row').not('.grid-row-template').length;
        // Don't try and populate if not in freeform mode.
        if(my.layout === 'freeform') {return;}
        if(num_rows === 0){
            addNewRow();
        }
        console.log('numrows', num_rows);
        rows_field.find('option').remove();
        // Add new option fields - d3 range is exclusive so we add one
        d3.map(d3.range(1, num_rows + 1), function(i){
            var option = $('<option></option>');
            option.val(i).text('row ' + i);
            rows_field.append(option);
        });
        // Update current value
        if(row) {rows_field.val(row)};
    }

    function populateOrderField(module) {
        var widgets = $('.item.widget');
        // Add the number of items to order field.
        var order_field = MODULE_FORM.find('[name="order"]');
        var max_options = widgets.length > 0 ? widgets.length + 1 : 2;
        order_field.find('option').remove();
        // Add empty option.
        order_field.append('<option value=""></option>');
        d3.map(d3.range(1, max_options), function(i){
            var option = $('<option></option>');
            option.val(i).text(i);
            order_field.append(option);
        });
        order_field.val(module && module.order ? module.order : '');
    }

    /**
     * [getParsedFormConfig Get a config usable for each json widget based on the forms active values.]
     * @return {[object]} [The serialized config]
     */
    function getParsedFormConfig() {
        var conf = {};
        MODULE_FORM.find('.form-control').each(function(_, input){
            var name = $(input).attr('name');
            var val = $(input).val();
            if(name === 'override' ||
                name === 'refresh') {
                // Convert checkbox to json friendly format.
                conf[name] = $(input).is(':checked');
            } else if(name === 'refreshInterval' ||
                      name === 'row' ||
                      name === 'height' ||
                      name === 'order') {
                conf[name] = parseInt(val, 10);
                if(isNaN(conf[name])) {
                    conf[name] = null;
                }
            } else {
                conf[name] = val;
            }
            // This is not amenable to integer parsing
            if(name === 'width' && my.layout === 'grid') {
                conf['width'] = val;
            }
        });
        return conf;
    }

    function updateModule(e){
        // Updates the module input fields with new data by rewriting them all.
        var guid = MODULE_FORM.attr('data-guid');
        var active = getModuleByGUID(guid);
        var conf = getParsedFormConfig();
        var newconf = $.extend(active, conf);
        $('.modules').find('#' + guid).val(JSON.stringify(newconf));
        updateWidget(newconf);
        EDIT_CONTAINER.collapse();
        // Refit the grid
        fitGrid();
    }

    function updateWidget(config) {
        // Trigger update form into view since data is dirty
        // Update visual size to existing widget.
        var widget = my.widgets[config.guid].el;
        loader(widget);
        widget.style({
            height: config.height + 'px',
            width: my.layout === 'grid' ? '100%' : config.width + 'px'
        });
        if(my.layout === 'grid') {
            var colcount = config.width.split('-')[1];
            var parent = d3.select(widget.node().parentNode);
            removeGridClasses(parent);
            addGridClasses(parent, [colcount]);
        }
        widget.select('.widget-title .widget-title-text').text(config.name);
        loadWidgetData(widget, config);
    }

    function addGridClasses(sel, classes) {
        d3.map(classes, function(colcount){
            var classlist = {};
            classlist['col-md-' + colcount] = true;
            classlist['col-lg-' + colcount] = true;
            sel.classed(classlist);
        });
    }

    function removeGridClasses(sel) {
        var bootstrap_classes = d3.range(1, 13);
        d3.map(bootstrap_classes, function(i){
            var classes = {};
            classes['col-md-' + i] = false;
            classes['col-lg-' + i] = false;
            sel.classed(classes);
        });
    }

    function refreshWidget(e) {
        e.preventDefault();
        var config = getModule($(this).closest('.widget'));
        var widget = addWidget(MAIN_CONTAINER, config);
        loadWidgetData(widget, config);
        fitGrid();
    }

    function addChartContainers(container, data) {
        for(var name in data.modules){
            // Closure to maintain each chart data value in loop
            (function(config){
                var config = data.modules[name];
                // Add div wrappers for js grid layout library,
                // and add title, icons, and buttons
                var widget = addWidget(container, config);
                my.widgets[config.guid] = {el: widget, config: config};
            })(data.modules[name]);
        }
        fitGrid();
        for(var guid in my.widgets){
            var widg = my.widgets[guid];
            loadWidgetData(widg.el, widg.config);
        }
    }

    function getModuleByGUID(guid) {
        return my.widgets[guid].config;
    }

    function deleteModule(e) {
        e.preventDefault();
        if(!confirm('Are you sure?')) {return;}
        var guid = MODULE_FORM.attr('data-guid');
        // Remove form input and visual widget
        $('.modules').find('#' + guid).remove();
        $('.item.widget[data-guid="' + guid + '"]').remove();
        EDIT_MODAL.modal('hide');
        // Redraw wall to replace visual 'hole'
        fitGrid();
        // Trigger update form into view since data is dirty
        EDIT_CONTAINER.collapse('show');
    }

    function isPreviewableType(type) {
        if(type === 'iframe') {return false;}
        if(type === 'youtube') {return false;}
        if(type === 'custom') {return false;}
        return true;
    }

    function chartsTypeChanged(e) {
        var active_conf = getFormConfig();
        var previewable = isPreviewableType(active_conf.type);
        togglePreviewOutput(previewable);
    }

    function addDomEvents() {
        // Chart type change
        MODULE_FORM.find('[name="type"]').on('change.charts.type', chartsTypeChanged);
        // TODO: debounce/throttle
        API_ROUTE_URL.on('change.charts', previewAPIRoute);
        API_PREVIEW_BTN.on('click.charts', previewAPIRoute);
        // Save module popup form
        SAVE_MODULE.on('click.charts.module', saveModule);
        // Edit existing modules
        EDIT_MODAL.on('show.bs.modal', updateEditForm);
        UPDATE_FORM_BTN.on('click.charts.module', updateModule);

        // Allow swapping of edit/update events
        // for the add module button and form modal
        ADD_MODULE.on('click.charts', function(){
            UPDATE_FORM_BTN
            .attr('id', SAVE_MODULE.selector.replace('#', ''))
            .text('Save module')
            .off('click.charts.module')
            .on('click.charts', saveModule);
        });

        // Allow swapping of edit/update events
        // for the add module per row button and form modal
        VIEW_BUILDER.on('click.charts', '.grid-row-label', function(){
            UPDATE_FORM_BTN
            .attr('id', SAVE_MODULE.selector.replace('#', ''))
            .text('Save module')
            .off('click.charts.module')
            .on('click.charts', saveModule);
        });

        // Allow swapping of edit/update events
        // for the edit button and form modal
        $('.widget-edit').on('click.charts', function(){
            SAVE_MODULE
            .attr('id', UPDATE_FORM_BTN.selector.replace('#', ''))
            .text('Update module')
            .off('click.charts.module')
            .on('click.charts', updateModule);
        });
        // Add delete button for existing widgets.
        DELETE_BTN.on('click.charts', deleteModule);
        // Add delete confirm for dashboards.
        DELETE_DASHBOARD.on('submit.charts', function(e){
            if(!confirm('Are you sure?')) e.preventDefault();
        });
    }

    function initGrid(container) {
        fitGrid({
            columnWidth: 5,
            itemSelector: '.item',
            transitionDuration: 0,
            fitWidth: true
        }, true);
        $('.item.widget').removeClass('hidden');
    }

    function fitGrid(opts, init) {
        if(my.layout === 'grid') {return;}
        var valid_options = $.isPlainObject(opts);
        var options = $.extend({}, opts, {});
        if(init) {
            my.chart_wall = $('#container').packery(options);
            items = my.chart_wall.find('.item').draggable({
                scroll: true,
                handle: '.dragger',
                stop: function(){
                    EDIT_CONTAINER.collapse('show');
                    updateModuleOrder();
                    my.chart_wall.packery(options);
                }
            });
            my.chart_wall.packery('bindUIDraggableEvents', items);
        } else {
            my.chart_wall.packery(options);
        }
    }

    function updateModuleOrder() {
        var items = my.chart_wall.packery('getItemElements');
        // Update module order
        $.each(items, function(i, el){
            var module = getModule($(this));
            var config = $.extend(module, {order: i});
            updateModuleInput(config);
        });
    }

    function getModule(el) {
        // Return module by element
        var data = el.data();
        var guid = data.guid;
        return getModuleByGUID(guid);
    }

    function loader(container) {
        container.select('.loader-overlay').classed({hidden: false});
        container.select('.widget-loader').classed({hidden: false});
    }

    function unload(container) {
        container.select('.loader-overlay').classed({hidden: true});
        container.select('.widget-loader').classed({hidden: true});
    }

    function handleInputs(widget, config) {
        var inputs_selector = '[data-guid="' + config.guid + '"] .chart-inputs';
        // Load event handlers for these newly created forms.
        $(inputs_selector).find('form').on('submit', function(e){
            e.stopImmediatePropagation();
            e.preventDefault();
            // Just create a new url for this, but use existing config.
            // The global object config will not be altered.
            // The first {} here is important, as it enforces a deep copy,
            // not a mutation of the original object.
            var url = config.dataSource;
            // Ensure we don't lose params already save on this endpoint url.
            var existing_params = url.split('?')[1];
            var params = getValidParamString($(this).serializeArray());
            var _config = $.extend({}, config, {
                dataSource: url.replace(/\?.+/, '') + '?' + existing_params + '&' + params
            });
            // Otherwise reload like normal.
            loadWidgetData(widget, _config);
            // Hide the form again
            $(inputs_selector).removeClass('in');
        });
    }

    function getValidParamString(arr) {
        // Jquery $.serialize and $.serializeArray will
        // return empty query parameters, which is undesirable and can
        // be error prone for RESTFUL endpoints.
        // e.g. `foo=bar&bar=` becomes `foo=bar`
        var param_str = '';
        arr = arr.filter(function(param, i){return param.value !== '';});
        $.each(arr, function(i, param){
            param_str += (param.name + '=' + param.value);
            if(i < arr.length - 1 && arr.length > 1) param_str += '&';
        });
        return param_str;
    }

    function loadWidgetData(widget, config) {
        loader(widget);

        try {
            // Handle any custom inputs the user specified for this module.
            // They map to standard form inputs and correspond to query
            // arguments for this dataSource.
            if(config.inputs) {handleInputs(widget, config);}

            if(config.type === 'datatable') {
                jsondash.handlers.handleDataTable(widget, config);
            }
            else if(jsondash.util.isSparkline(config.type)) {
                jsondash.handlers.handleSparkline(widget, config);
            }
            else if(config.type === 'iframe') {
                jsondash.handlers.handleIframe(widget, config);
            }
            else if(config.type === 'timeline') {
                jsondash.handlers.handleTimeline(widget, config);
            }
            else if(config.type === 'venn') {
                jsondash.handlers.handleVenn(widget, config);
            }
            else if(config.type === 'number') {
                jsondash.handlers.handleSingleNum(widget, config);
            }
            else if(config.type === 'youtube') {
                jsondash.handlers.handleYoutube(widget, config);
            }
            else if(config.type === 'graph'){
                jsondash.handlers.handleGraph(widget, config);
            }
            else if(config.type === 'custom') {
                jsondash.handlers.handleCustom(widget, config);
            }
            else if(config.type === 'wordcloud') {
                jsondash.handlers.handleWordCloud(widget, config);
            }
            else if(config.type === 'plotly-any') {
                jsondash.handlers.handlePlotly(widget, config);
            }
            else if(jsondash.util.isD3Subtype(config)) {
                jsondash.handlers.handleD3(widget, config);
            } else {
                jsondash.handlers.handleC3(widget, config);
            }
        } catch(e) {
            if(console && console.error) console.error(e);
            unload(widget);
        }
        addResizeEvent(widget, config);
    }

    function addResizeEvent(widget, config) {
        // Add resize event
        $(widget[0]).resizable({
            helper: 'resizable-helper',
            minWidth: 200,
            minHeight: 200,
            maxWidth: VIEW_BUILDER.width(),
            handles: my.layout === 'grid' ? 'n, s' : 'e, s, se',
            stop: function(event, ui) {
                var newconf = {height: ui.size.height};
                if(my.layout !== 'grid') {
                    newconf['width'] = ui.size.width;
                }
                // Update the configs dimensions.
                config = $.extend(config, newconf);
                updateModuleInput(config);
                loadWidgetData(widget, config);
                fitGrid();
                // Open save panel
                EDIT_CONTAINER.collapse('show');
            }
        });
    }

    function updateModuleInput(config) {
        $('input[id="' + config.guid + '"]').val(JSON.stringify(config));
    }

    function prettyCode(code) {
        if(typeof code === "object") return JSON.stringify(code, null, 4);
        return JSON.stringify(JSON.parse(code), null, 4);
    }

    function addRefreshers(modules) {
        $.each(modules, function(_, module){
            if(module.refresh && module.refreshInterval) {
                var container = d3.select('[data-guid="' + module.guid + '"]');
                setInterval(function(){
                    loadWidgetData(container, module);
                }, parseInt(module.refreshInterval, 10));
            }
        });
    }

    function prettifyJSONPreview() {
        // Reformat the code inside of the raw json field,
        // to pretty print for the user.
        JSON_DATA.text(prettyCode(JSON_DATA.text()));
    }

    function setupResponsiveEvents() {
        // This is handled by bs3, so we don't need it.
        if(my.layout === 'grid') {return;}
        // Setup responsive handlers
        var jres = jRespond([
        {
            label: 'handheld',
            enter: 0,
            exit: 767
        }
        ]);
        jres.addFunc({
            breakpoint: 'handheld',
            enter: function() {
                $('.widget').css({
                    'max-width': '100%',
                    'width': '100%',
                    'position': 'static'
                });
            }
        });
    }

    function addNewRow(e) {
        // Add a new row with a toggleable label that indicates
        // which row it is for user editing.
        if(e) {e.preventDefault();}
        var placement = $(this).closest('.row').data().rowPlacement;
        var el = ROW_TEMPLATE.clone(true);
        if(placement === 'top') {
            VIEW_BUILDER.find('.add-new-row-container:first').after(el);
        } else {
            VIEW_BUILDER.find('.add-new-row-container:last').before(el);
        }
    }

    function loadDashboard(data) {
        // Load the grid before rendering the ajax, since the DOM
        // is rendered server side.
        initGrid(MAIN_CONTAINER);
        // Add actual ajax data.
        addChartContainers(MAIN_CONTAINER, data);
        my.dashboard_data = data;

        // Add event handlers for widget UI
        $('.widget-refresh').on('click.charts', refreshWidget);

        // Setup refresh intervals for all widgets that specify it.
        addRefreshers(data.modules);

        // Format json config display
        $('#json-output').on('show.bs.modal', function(e){
            var code = $(this).find('code').text();
            $(this).find('code').text(prettyCode(code));
        });

        // Add event for downloading json config raw.
        // Will provide decent support but still not major: http://caniuse.com/#search=download
        $('[href="#download-json"]').on('click', function(e){
            var datestr = new Date().toString().replace(/ /gi, '-');
            var data = encodeURIComponent(JSON.stringify(JSON_DATA.val(), null, 4));
            data = "data:text/json;charset=utf-8," + data;
            $(this).attr('href', data);
            $(this).attr('download', 'charts-config-raw-' + datestr + '.json');
        });

        // For fixed grid, add events for making new rows.
        ADD_ROW_CONTS.find('.btn').on('click', addNewRow);

        EDIT_TOGGLE_BTN.on('click', function(e){
            $('body').toggleClass('jsondash-editing');
        });

        prettifyJSONPreview();
        setupResponsiveEvents();
        populateOrderField();
        populateRowField();
        fitGrid();
    }
    my.config = {
        WIDGET_MARGIN_X: 20,
        WIDGET_MARGIN_Y: 60
    };
    my.loadDashboard = loadDashboard;
    my.handlers = {};
    my.util = {};
    my.loader = loader;
    my.unload = unload;
    my.addDomEvents = addDomEvents;
    my.getActiveConfig = getParsedFormConfig;
    my.layout = VIEW_BUILDER.length > 0 ? VIEW_BUILDER.data().layout : null;
    my.dashboard_data = dashboard_data;
    return my;
}();
