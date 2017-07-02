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
