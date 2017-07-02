app.module("core", function(modules, name) {
    // import whats needed
    var $$ = modules.$$;
    var utils = modules.utils,
        storage = utils.storage,
        shuffle = utils.shuffle,
        random_item = utils.random_item;
    /**
     * @description [Shows save option if localStorage available.]
     */
    function init_localstorage() {
        // return if no localStorage
        if (!storage) return;
        // show save options container
        $$.option_cont_store.classList.remove("none");
        // if localStorage present but no options saved...
        // ...default options will be turned on.
        if (!localStorage.length) return;
        // get the save options classes
        var classes = $$.option_save.classList;
        // add/remove necessary classes
        classes.remove("option-off");
        classes.add("option-on-blue");
        // reset the options based on local storage
        restore_options();
        all_options_off(); // enable the action buttons
    }
    /**
     * @description [If user saved his/her preferences options are restored to match preferences.]
     */
    function restore_options() {
        // set options to match local storage
        for (var i = 0, l = $$.option_elements.length; i < l; i++) {
            // skip the first one, "save options"
            if (i === 0) continue;
            // cache current option + its classes
            var option = $$.option_elements[i],
                classes = option.classList;
            // get the user preference localStorage
            if (localStorage.getItem(option.dataset.optionName) === "true") { // option on
                classes.remove("option-off");
                classes.add("option-on");
            } else { // option turned off
                classes.remove("option-on");
                classes.add("option-off");
            }
        }
        // reset the length input
        $$.length_input.value = localStorage.getItem("plength");
    }
    /**
     * @description [If all options are turned off disable copy and generate buttons.]
     */
    function all_options_off() {
        // define counter
        // 2 is subtracted to account for "save option" & "similar chars"
        var off_counter = $$.option_elements.length - 2;
        for (var i = 0, l = $$.option_elements.length; i < l; i++) {
            // skip the first one, "save options"
            if (i === 0) continue;
            // cache current option
            var option = $$.option_elements[i];
            // decrease counter by 1 for each turned off option
            if (option.dataset.optionName !== "similar" && !option.classList.contains("option-on")) off_counter--;
        }
        if (!off_counter) { // all options off
            $$.text_password.textContent = "• • • • • • • • • •";
            $$.text_password.setAttribute("disabled", true);
            $$.app_actions_cont.classList.add("disabled");
            $$.length_input.classList.add("disabled");
        } else {
            $$.text_password.removeAttribute("disabled", false);
            $$.app_actions_cont.classList.remove("disabled");
            $$.length_input.classList.remove("disabled");
        }
    }
    /**
     * @description [Stores options in localStorage.]
     */
    function store_options() {
        // return and don't save anything if "save option" is turned off.
        if ($$.option_save.classList.contains("option-off")) return;
        // loop through options, store status in localStorage
        for (var i = 0, l = $$.option_elements.length; i < l; i++) {
            // skip the first one, "save options"
            if (i === 0) continue;
            // cache current option
            var option = $$.option_elements[i];
            localStorage.setItem(option.dataset.optionName, (option.classList.contains("option-off") ? false : true));
        }
        // reset the length input
        localStorage.setItem("plength", $$.length_input.value);
    }
    /**
     * @description [Resets options to default status. Everything on but spaces and save option turned off.
     *               Input length set to default 20 value.]
     */
    function reset_options() {
        for (var i = 0, l = $$.option_elements.length; i < l; i++) {
            // cache current option classes
            var classes = $$.option_elements[i].classList;
            if (i === 0) {
                // the first one is the save option
                // must be blue
                classes.remove("option-on-blue");
                classes.add("option-off");
            } else {
                // everything else on
                classes.remove("option-off");
                classes.add("option-on");
            }
            if (l - 1 === i) {
                // the last one must be turned off
                // spaces off my default
                classes.remove("option-on");
                classes.add("option-off");
            }
        }
        // reset the length input
        $$.length_input.value = "20";
        all_options_off();
    }
    /**
     * @description [Generates password.]
     * @return {String} password [The generated password.]
     */
    function generate_password() {
        // build random string from user options
        var charset_array = build_charset(get_options());
        // get the user provided password length
        var password_length = parseInt($$.length_input.value, 10);
        var password = [];
        // start building password...
        while (password_length >= 1) {
            // shuffle array
            password.push(random_item(shuffle(charset_array)));
            password_length--;
        }
        return password.join("");
    }
    /**
     * @description [Embeds the generated password into page.]
     */
    function embed_password() {
        // generate password
        var password = generate_password();
        // embed password
        $$.text_password.textContent = password;
    }
    /**
     * @description [Builds the usable character set. This depends on the options the user specified.]
     * @param  {Object} options
     * @return {Array} [An array containing all possible characters to build passwords from.]
     */
    function build_charset(options) {
        // cache options
        var ambiguous = options.ambiguous,
            enclosures = options.enclosures,
            lowercase = options.lowercase,
            numbers = options.numbers,
            punctuation = options.punctuation,
            similar = options.similar,
            spaces = options.spaces,
            symbols = options.symbols,
            uppercase = options.uppercase;
        // define charsets
        var charset_letters = "abcdefghijklmnopqrstuvwxyz",
            charset_numbers = "0123456789",
            charset_punctuation = ".?!,;:-'\"",
            charset_enclosures = "(){}[]<>",
            charset_symbols = "@#$%^&*",
            charset_ambiguous = "~`_=+\\|/",
            charset_similar = "1iIlL0oO",
            charset_space = " ";
        // start building string
        var string = "";
        if (uppercase) string += charset_letters.toUpperCase();
        if (lowercase) string += charset_letters;
        if (numbers) string += charset_numbers;
        if (punctuation) string += charset_punctuation;
        if (enclosures) string += charset_enclosures;
        if (symbols) string += charset_symbols;
        if (ambiguous) string += charset_ambiguous;
        if (spaces) string += charset_space;
        // remove similar characters if flag provided
        if (!similar) string = string.replace(/[1iIlL0oO]/g, "");
        // finally return the built string in an array
        return string.split("");
    }
    /**
     * @description [Makes an object containing the generator options and whether they are on or off.]
     * @return {Object} options [Contains value:key pairs, i.e. "numbers":"true", "lowercase":"false".
     *                           for all generator options.]
     */
    function get_options() {
        // define options object
        var options = {};
        // loop through every options element...
        for (var i = 0, l = $$.option_elements.length; i < l; i++) {
            // cache current option
            var option = $$.option_elements[i];
            // add option and its status to options object
            options[option.dataset.optionName] = (option.classList.contains("option-on") ? true : false);
        }
        return options;
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
     * @description [Sets up ClipboardJS.]
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
    // export to access in other modules
    this[name]["init_localstorage"] = init_localstorage;
    this[name]["restore_options"] = restore_options;
    this[name]["all_options_off"] = all_options_off;
    this[name]["store_options"] = store_options;
    this[name]["reset_options"] = reset_options;
    this[name]["generate_password"] = generate_password;
    this[name]["embed_password"] = embed_password;
    this[name]["build_charset"] = build_charset;
    this[name]["get_options"] = get_options;
    this[name]["is_copy_supported"] = is_copy_supported;
    this[name]["init_clipboard"] = init_clipboard;
}, "complete");
