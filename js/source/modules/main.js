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
