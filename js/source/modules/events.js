app.module("events", function(modules, name) {
    // import whats needed
    var $$ = modules.$$;
    var core = modules.core,
        embed_password = core.embed_password,
        reset_options = core.reset_options;
    var libs = modules.libs,
        Funnel = libs.Funnel;
    var globals = modules.globals,
        monitor = globals.monitor;
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
            // replace everything but numbers to check if empty...
            // if value is empty stop function, store the new length, and return
            if (val.replace(/[^0-9]/g, "") === "") {
                monitor.set("user.plength", 0);
                input.value = "";
                return;
            }
            // check if number is with in allowed range
            var parse_value = parseInt(val, 10);
            // bigger than 1024 reset to 1024
            if (parse_value > 1024) parse_value = 1024;
            // smaller than 1, i.e. 0, reset to 1
            if (parse_value < 1) parse_value = 1;
            // set the new input value
            input.value = parse_value;
            // reset the caret to the position that it was
            input.setSelectionRange(selection_start, selection_end);
            // store the new length
            monitor.set("user.plength", parse_value);
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
                // if parsed value is < than 1 reset to 1...else decrease value by 1
                if (key_code === 40) parse_value = ((parse_value < 2) ? 1 : (parse_value - 1));
                // if parsed value is > than 1024 reset to 1024...else increase value by 1
                else parse_value = ((parse_value > 1023) ? 1024 : (parse_value + 1));
                // set the new input value
                input.value = parse_value;
                // store the new length
                monitor.set("user.plength", parse_value);
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
            // cache the target element
            var target = e.target;
            // delegation/filter via FunnelJS
            var parents = Funnel(target)
                .parents()
                .getStack();
            var delegate = Funnel(target)
                .concat(parents)
                .classes("option-status")
                .getElement();
            // if there is a wanted filtered element (delegate)
            if (delegate) {
                // cache the delegates data option name
                var option_name = delegate.dataset.optionName;
                // update the monitor. toggle value
                monitor.set("user." + option_name, !monitor.object.user[option_name]);
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
    $$.length_input.addEventListener("input", handlers.length_check, false);
    $$.length_input.addEventListener("paste", handlers.length_check, false);
    // increase/decrease input value on respective keypress
    $$.length_input.addEventListener("keydown", handlers.input_length_keypress, false);
    // toggle generator options
    document.addEventListener("click", handlers.toggle_option, false);
    // listen to button clicks
    document.addEventListener("click", handlers.btn_clicks, false);
}, "complete");
