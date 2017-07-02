// IIFE start
(function(window) {
    "use strict";
    (function() {
        // add to global scope for ease of use
        // use global app var or create it if not present
        var app = window.app || (window.app = {}),
            counter = {
                complete: 0,
                interactive: 0
            },
            queue = {
                complete: [],
                interactive: []
            };
        // add a module to load
        app.module = function(module_name, fn, mode) {
            // determine what array the module needs to be added to
            var type = !mode || mode === "complete" ? "complete" : "interactive";
            // add the module to the queue
            queue[type].push([module_name, fn]);
        };
        // app module invoker
        var invoke = function(mode) {
            // get the queued array
            var modules = queue[mode];
            // if no modules, return
            if (!modules.length) return;
            // run the modules one after another
            // get the first module
            load(modules, counter[mode], mode);
        };
        var load = function(modules, count, mode) {
            // get the current module + its information
            var module = modules[count];
            // if no module exists all modules have loaded
            if (!module) return;
            // get the module information
            var module_name = module[0],
                fn = module[1];
            // run the module and the load() function
            (function() {
                // add the module name to the app
                app[module_name] = app[module_name] || {};
                // call the module and run it
                fn.call(app, app, module_name);
                // increase the counter
                counter[mode]++;
                // run the load function again
                load(modules, counter[mode], mode);
            })();
        };
        // cleanup the app variable
        var cleanup = function() {
            // remove unneeded properties once
            // the app has loaded
            delete app.module;
            delete app.invoke;
        };
        // https://developer.mozilla.org/en-US/docs/Web/Events/readystatechange
        // the readystatechange event is fired when the readyState attribute of a
        // document has changed
        document.onreadystatechange = function() {
            // https://developer.mozilla.org/en-US/docs/Web/API/Document/readyState
            // loading === document still loading
            // complete === document and all sub-resources have finished loading.
            // same as the window.onload event
            // interactive === document has finished loading & parsed but but
            // sub-resources such as images, stylesheets and frames are still loading
            // **Note: interactive === document.addEventListener("DOMContentLoaded",...
            // **Note: complete    === window.addEventListener("load", function() {...
            // [DOMContentLoaded](https://developer.mozilla.org/en-US/docs/Web/Events/DOMContentLoaded)
            // [load](https://developer.mozilla.org/en-US/docs/Web/Events/load)
            // document loaded and parsed. however, still loading subresources
            // user is able to interact with page.
            if (document.readyState === "interactive") {
                // invoke the modules set to mode interactive
                invoke("interactive");
            }
            // all resources have loaded (document + subresources)
            if (document.readyState === "complete") {
                // invoke the modules set to mode complete
                invoke("complete");
                // cleanup app var once everything is loaded
                cleanup();
            }
            // good explanation with images:
            // https://varvy.com/performance/document-ready-state.html
        };
    })();
    app.module("libs", function(modules, name) {
        // init FastClickJS
        if ("addEventListener" in document) {
            FastClick.attach(document.body);
        }
    }, "interactive");
    app.module("globals", function(modules, name) {}, "complete");
    app.module("utils", function(modules, name) {
        /**
         * @description [detects browsers localStorage]
         * @source [https://mathiasbynens.be/notes/localstorage-pattern]
         * @source-complementary [http://diveintohtml5.info/storage.html]
         */
        var storage = (function() {
            var uid = new Date(),
                storage, result;
            try {
                (storage = window.localStorage)
                .setItem(uid, uid);
                result = storage.getItem(uid) == uid;
                storage.removeItem(uid);
                return result && storage;
            } catch (exception) {}
        }());
        /**
         * @description [Shuffles provided array.]
         * @source [http://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array-in-javascript]
         * @param {Array} array [The array to shuffle.]
         * @return {Array} array [Returns provided array now shuffled.]
         */
        function shuffle(array) {
            var counter = array.length;
            // While there are elements in the array
            while (counter > 0) {
                // Pick a random index
                var index = Math.floor(Math.random() * counter);
                // Decrease counter by 1
                counter--;
                // And swap the last element with it
                var temp = array[counter];
                array[counter] = array[index];
                array[index] = temp;
            }
            return array;
        }
        /**
         * @description [Return a random item from an array.]
         * @param  {Array} provided_array [The array to get item from.]
         * @return {String} [In this case a character will be returned.]
         */
        function random_item(provided_array) {
            return provided_array[Math.floor(Math.random() * provided_array.length)];
        }
        // export to access in other modules
        this[name].storage = storage;
        this[name].shuffle = shuffle;
        this[name].random_item = random_item;
    }, "complete");
    app.module("$$", function(modules, name) { // cache vars
        var d = document,
            $ = function(id) {
                return d.getElementById(id);
            };
        // export to access in other modules
        this[name]["length_input"] = $("password-length"),
            this[name]["option_save"] = $("option-save"),
            this[name]["option_cont_store"] = $("option-cont-store"),
            this[name]["option_elements"] = d.getElementsByClassName("option-status"),
            this[name]["text_password"] = $("text-password"),
            this[name]["app_actions_cont"] = $("app-actions-cont"),
            this[name]["btn_copy"] = $("btn-action-copy"),
            this[name]["btn_select"] = $("btn-action-select"),
            this[name]["btn_generate"] = $("btn-action-generate");
    }, "complete");
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
    app.module("events", function(modules, name) {
        // import whats needed
        var $$ = modules.$$;
        var core = modules.core,
            store_options = core.store_options,
            embed_password = core.embed_password,
            all_options_off = core.all_options_off,
            reset_options = core.reset_options;
        /**
         * @description [Object containing handler functions.]
         * @type {Object}
         */
        var handlers = {
            /**
             * @description [Checks inputed value. Keeps it to numbers and
             *               within the bounds (min=1, max=1024).]
             * @param {EventObject} e [Browser passed in Event Object.]
             */
            "length_check": function(e) {
                // cache input element
                var input = e.target;
                // get selection data from input
                var selection_start = input.selectionStart,
                    selection_end = input.selectionEnd;
                // cache input value
                var val = input.value.trim();
                // if value is empty stop function
                if (val === "") return;
                // replace everything but numbers
                input.value = val.replace(/[^0-9]/g, "");
                // check if number is with in allowed range
                var parse_value = parseInt(val, 10);
                // bigger than 1024 reset to 1024
                if (parse_value > 1024) input.value = "1024";
                // smaller than 1, i.e. 0, reset to 1
                if (parse_value < 1) input.value = "1";
                // reset the caret to the position that it was
                input.setSelectionRange(selection_start, selection_end);
                // store the changes to local storage
                store_options();
            },
            /**
             * @description [Increases/decreases length and keeps it
             *               within the bounds (min=1, max=1024).]
             * @param {EventObject} e [Browser passed in Event Object.]
             */
            "input_length_keypress": function(e) {
                // cache the key_code
                var key_code = e.keyCode;
                // shift key must be pressed
                if (!e.shiftKey) return;
                if ([38, 40].indexOf(key_code) !== -1) {
                    // cache input element
                    var input = e.target;
                    // get selection data from input
                    var selection_start = input.selectionStart,
                        selection_end = input.selectionEnd;
                    // cache input value
                    var val = input.value;
                    // parsed value
                    var parse_value = parseInt(val, 10);
                    // decrease value if key_code is 40
                    if (key_code === 40) {
                        // if parsed value is less than 1 reset to 1
                        if (parse_value < 2) input.value = 1;
                        // decrease value by 1
                        else input.value = parse_value - 1;
                    } else {
                        // increase the value
                        // if parsed value is greater than 1024 reset to 1024
                        if (parse_value > 1023) input.value = 1024;
                        // increase value by 1
                        else input.value = parse_value + 1;
                    }
                    // reset the caret to the position that it was
                    input.setSelectionRange(selection_start, selection_end);
                    // prevent input focus
                    e.preventDefault();
                } else if (key_code === 13) {
                    // generate a password
                    embed_password();
                }
            },
            /**
             * @description [Toggles option status (turns it off/on).]
             * @param {EventObject} e [Browser passed in Event Object.]
             */
            "toggle_option": function(e) {
                // cache target element
                var target = e.target;
                // check if element is an option element
                if (target.classList.contains("option-status") || target.classList.contains("fa-check")) {
                    // reset target var to parent if actual checkmark is clicked
                    if (target.classList.contains("fa-check")) {
                        target = target.parentNode;
                    }
                    if (target.classList.contains("option-on") || target.classList.contains("option-on-blue")) {
                        // clear the storage if save option is ticked off
                        if (target.classList.contains("option-on-blue")) {
                            localStorage.clear();
                        }
                        target.classList.remove("option-on");
                        target.classList.remove("option-on-blue");
                        target.classList.add("option-off");
                    } else {
                        target.classList.remove("option-off");
                        if (target.dataset.optionName === "preferences") {
                            target.classList.add("option-on-blue");
                        } else target.classList.add("option-on");
                    }
                    // store the changes to local storage
                    store_options();
                    embed_password();
                    all_options_off();
                }
            },
            /**
             * @description [Listens for button clicks.]
             * @param {EventObject} e [Browser passed in Event Object.]
             */
            "btn_clicks": function(e) {
                var $target = e.target;
                if ($target.id === "btn-action-generate") {
                    embed_password();
                } else if ($target.id === "option-label-reset") {
                    // clear storage
                    localStorage.clear();
                    // reset options
                    reset_options();
                    // generate password
                    embed_password();
                } else if ($target.id === "btn-action-select") {
                    // set focus on the password element
                    $$.text_password.focus();
                    // select the password
                    // http://stackoverflow.com/questions/6139107/programatically-select-text-in-a-contenteditable-html-element/13641884#13641884
                    document.execCommand('selectAll', false, null);
                }
            }
        };
        // check inputed password length
        $$.length_input.addEventListener("input", handlers.length_check);
        $$.length_input.addEventListener("paste", handlers.length_check);
        // increase/decrease input value on respective keypress
        $$.length_input.addEventListener("keydown", handlers.input_length_keypress);
        // toggle generator options
        document.addEventListener("click", handlers.toggle_option);
        // listen to button clicks
        document.addEventListener("click", handlers.btn_clicks);
    }, "complete");
    app.module("main", function(modules, name) {
        // import whats needed
        var core = modules.core;
        // initialize clipboardjs
        core.init_clipboard();
        // initialize local storage
        core.init_localstorage();
        // generate password + embed to page
        core.embed_password();
    }, "complete");
    // IIFE end
})(window);