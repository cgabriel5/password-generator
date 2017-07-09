app.module("core", function(modules, name) {
    // import whats needed
    var $$ = modules.$$;
    var utils = modules.utils,
        local_storage = utils.storage;
    var libs = modules.libs,
        randomString = libs.randomString,
        Monitor = libs.Monitor;
    var globals = modules.globals,
        options = globals.options,
        $options = globals.$options;
    /**
     * @description [Self-invoked function that populates the $options object with
     *               a map of option_name: $option_element for ease of use throughout
     *               other functions.]
     * @return {Undefined} [Nothing is returned.]
     */
    (function build_options() {
        // get the option elements
        var elements = $$.option_elements;
        // loop over the elements
        for (var i = 0, l = elements.length; i < l; i++) {
            // cache the current option element
            var option = elements[i];
            // add the option_name: $option_element to the $options object
            $options[option.dataset.optionName] = option;
        }
    })();
    // use a Monitor to listen in on changes to the users object
    var monitor = new Monitor(null, options);
    // listen to the all user.* paths except for the user.plength path
    monitor.on(/^user(?!.plength).*/, function(path, type, newValue, oldValue, time) {
        // ignore deletions. deletions will be triggered when the generator is reset.
        // these deletions are not needed to be acted upon
        if (type === "delete") return;
        // get the option name
        var option_name = path.replace("user.", "");
        // modify the option's UI.
        // switch_option => state(on/off), optionElement, Boolean(is it the preferences option)
        switch_option((newValue ? "on" : "off"), $options[option_name], (option_name === "preferences"));
    });
    // listen to the user.hexonly path
    monitor.on(/^user.hexonly/, function(path, type, newValue, oldValue, time) {
        // only listen to update changes
        if (type === "update") {
            // get all options but preferences, plength, hexonly
            var list = Object.keys(monitor.object.user)
                .filter(function(option) {
                    // return all but the following options
                    return !-~["preferences", "hexonly", "plength"].indexOf(option);
                });
            // loop over the options list and set its value to false
            for (var i = 0, l = list.length; i < l; i++) {
                monitor.set("user." + list[i], false);
            }
        }
    });
    // listen to the all user.* paths except for the user.preferences, user.hexonly, and user.plength paths
    monitor.on(/^user(?!.preferences|.hexonly|.plength).*/, function(path, type, newValue, oldValue, time) {
        // only listen to update changes
        if (type === "update") {
            // only when the new value is equal to true
            if (newValue === true) {
                // to not trigger the monitor, normally update the value
                // without the use if the monitor.set() method
                monitor.object.user.hexonly = false;
                // because the monitor.set() method is not being invoked
                // the UI switch must also be done here
                switch_option("off", $options["hexonly"]);
            }
        }
    });
    // listen to the all user.* paths for changes
    monitor.on(/^user\.*/, function(path, type, newValue, oldValue, time) {
        // ignore deletions. deletions will be triggered when the generator is reset.
        // these deletions are not needed to be acted upon
        if (type === "delete") return;
        // store the users' options in localStorage
        store_options();
        // if the active property is set to true create a new
        // password an options value changes
        if (monitor.object.active) embed_password();
        // check whether UI needs to be disabled
        // cache the users object
        var values = monitor.object.user;
        // flag indicating whether an option with a value of true exists
        var true_value_exists = false;
        // loop over the values
        for (var value in values) {
            if (values.hasOwnProperty(value)) {
                // skip the following options as they are allowed on (set to true)
                if (-~["preferences", "similar", "plength"].indexOf(value)) continue;
                // for any other option that is set to true...set the flag to true
                // and break out of the loop. this indicate that the UI does not need
                // to be disabled. as there is an active option.
                if (values[value] === true) {
                    true_value_exists = true;
                    break;
                }
            }
        }
        // if true_value_exists is set to true there  toggle UI
        monitor.set("UI_enabled", true_value_exists);
    });
    // listen to the UI_enabled property for any changes to it
    monitor.on("UI_enabled", function(path, type, newValue, oldValue, time) {
        if (!newValue) { // all options off, disable the generator UI
            $$.text_password.textContent = "• • • • • • • • • •";
            $$.text_password.setAttribute("disabled", true);
            $$.app_actions_cont.classList.add("disabled");
            $$.length_input.classList.add("disabled");
        } else { // enable the UI
            $$.text_password.removeAttribute("disabled", false);
            $$.app_actions_cont.classList.remove("disabled");
            $$.length_input.classList.remove("disabled");
        }
    });
    // listen to the active property for any changes to it
    monitor.on("active", function(path, type, newValue, oldValue, time) {
        // embed a new password when the generator is activated
        if (newValue === true) embed_password();
    });
    // listen to the user.plength property for any changes to it
    monitor.on("user.plength", function(path, type, newValue, oldValue, time) {
        // ignore deletions. deletions will be triggered when the generator is reset.
        // these deletions are not needed to be acted upon
        if (type === "delete") return;
        // set the length on the input element
        $$.length_input.value = newValue;
        // store the options in localStorage
        store_options();
    });
    // listen to the user.preferences property for any changes to it
    monitor.on("user.preferences", function(path, type, newValue, oldValue, time) {
        // ignore deletions. deletions will be triggered when the generator is reset.
        // these deletions are not needed to be acted upon
        if (type === "delete") return;
        // clear the localStorage
        if (newValue === false) localStorage.clear();
        // enable/disabled localStorage storing of options
        monitor.set("store", newValue);
    });
    /**
     * @description [Turns the option off or on, UI wise.]
     * @param  {String} status [The status the option should be set to.]
     * @return {Undefined}     [Nothing is returned.]
     */
    function switch_option(status, option, is_blue) {
        // reset the is_blue flag
        is_blue = (!is_blue ? "" : "-blue");
        // get the classes list
        var classes = option.classList;
        var prefix = "option-";
        // switch option "on"
        if (status === "on") {
            classes.remove(prefix + "off");
            classes.add(prefix + "on" + is_blue);
        } else if (status === "off") { // switch option "off"
            classes.remove(prefix + "on" + is_blue);
            classes.add(prefix + "off");
        }
    }
    /**
     * @description [Stores the users preferences in localStorage if localStorage is available
     *               and save option is on.]
     * @return {Undefined} [Nothing is returned.]
     */
    function store_options() {
        // only store when the save preferences option is set and if storage allowed
        if (monitor.object.store === false || !local_storage) return;
        // get the options
        var options = monitor.object.user;
        for (var option in options) {
            if (options.hasOwnProperty(option)) {
                // skip the plength as this is not a Boolean value.
                // it is stored later
                if (option === "plength") continue;
                // all other options are Booleans and can be easily stored.
                localStorage.setItem(option, options[option]);
            }
        }
        // store the length
        localStorage.setItem("plength", $$.length_input.value);
    }
    /**
     * @description [If user saved preferences, use the localStorage option values.]
     * @return {Undefined} [Nothing is returned.]
     */
    function restore_options() {
        // loop over the localStorage to restore the options
        for (var option in localStorage) {
            if (localStorage.hasOwnProperty(option)) {
                var value = localStorage.getItem(option);
                if (option === "plength") {
                    // plength is not a Boolean so the value can just be used as is
                    monitor.set("user." + option, value);
                } else {
                    // because localStorage values are stored as strings
                    // the value must be turned into a Boolean
                    monitor.set("user." + option, (value === "true") ? true : false);
                }
            }
        }
    }
    /**
     * @description [Embeds the generated password into page.]
     * @return {Undefined} [Nothing is returned.]
     */
    function embed_password() {
        // get the user options + generate password + embed password
        var options = monitor.object.user;
        // use Object.assign to create a new object with the property length
        // attached to it. plength is used in the user.<options> object as
        // localStorage uses the length property name to denote how many items
        // it contains.
        $$.text_password.textContent = randomString(Object.assign({
            "length": options.plength
        }, options));
    }
    /**
     * @description [Grabs the defaults options and injects them into the monitor.user object.]
     * @return {Undefined} [Nothing is returned.]
     */
    function turn_on_defaults() {
        // get the default options
        var defaults = options.defaults;
        // loop over the defaults
        for (var option in defaults) {
            if (defaults.hasOwnProperty(option)) {
                // store the option in the user.<object>
                monitor.set("user." + option, defaults[option]);
            }
        }
    }
    /**
     * @description [Resets the generator to its default settings and clears out the monitor cache.]
     * @return {Undefined} [Nothing is returned.]
     */
    function reset_options() {
        // get the defaults
        var defaults = monitor.object.defaults;
        // loop over the options and unset each
        Object.keys(defaults)
            .forEach(function(option) {
                monitor.unset("user." + option);
            });
        // deactivate the generator
        monitor.set("active", false);
        // clear the monitor cache
        monitor.cache = {};
        // reset the values to defaults
        turn_on_defaults();
        // reactivate the generator
        monitor.set("active", true);
    }
    /**
     * @description [Sets up ClipboardJS.]
     * @return {Undefined} [Nothing is returned.]
     */
    function init_clipboard() {
        // only setup clipboard if browser supports copying
        if (is_copy_supported()) {
            // show the copy button
            $$.btn_copy.classList.remove("none");
            // setup clipboard.js
            (new Clipboard($$.btn_copy))
            .on('success', function(e) {
                // cache input
                var input = e.trigger;
                // let user know it has copied
                input.textContent = "copied! :)";
                // clear previous timer set
                if (window.copied_msg_timer) clearTimeout(window.copied_msg_timer);
                // create a new timer, attach to window for easy access
                window.copied_msg_timer = setTimeout(function() {
                    // reset btn text after timer finishes
                    input.textContent = "copy";
                }, 1500);
                e.clearSelection();
            });
        } else { // browser does not support copy to clipboard action
            // show the select button
            $$.btn_select.classList.remove("none");
        }
        // show the generate button
        $$.btn_generate.classList.remove("none");
    }
    /**
     * @description [Checks whether browser supports copying to clipboard.]
     * @return {Boolean} [description]
     */
    function is_copy_supported() {
        // https://github.com/zenorocha/clipboard.js/issues/337
        // http://jsfiddle.net/the_ghost/679drp3r/
        return (!!document.queryCommandSupported && !!document.queryCommandSupported("copy"));
    }
    /**
     * @description [Depending on whether localStorage is supported, it sets the generators options
     *               either using the default values or the locally stored values.]
     * @return {Undefined} [Nothing is returned.]
     */
    function init_localstorage() {
        // if localStorage is not supported don't show the save preferences option
        if (local_storage) {
            // show save options container, as localStorage is supported
            $$.option_cont_store.classList.remove("none");
            // if no options are saved...default options will be turned on.
            if (!localStorage.length) {
                // turn on the default options
                turn_on_defaults();
            } else {
                // reset the options based on local storage
                restore_options();
            }
        } else {
            // no localStorage support
            turn_on_defaults();
        }
        // activate the generator
        monitor.set("active", true);
    }
    // export to access in other modules
    this[name]["turn_on_defaults"] = turn_on_defaults;
    this[name]["reset_options"] = reset_options;
    this[name]["embed_password"] = embed_password;
    this[name]["init_clipboard"] = init_clipboard;
    this[name]["init_localstorage"] = init_localstorage;
    this["globals"]["monitor"] = monitor;
}, "complete");
