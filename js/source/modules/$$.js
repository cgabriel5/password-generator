app.module("$$", function(modules, name) { // cache vars
    var d = document,
        $ = function(id) {
            return d.getElementById(id);
        };
    // export to access in other modules
    this[name]["length_input"] = $("password-length");
    this[name]["option_save"] = $("option-save");
    this[name]["option_cont_store"] = $("option-cont-store");
    this[name]["option_elements"] = d.getElementsByClassName("option-status");
    this[name]["text_password"] = $("text-password");
    this[name]["app_actions_cont"] = $("app-actions-cont");
    this[name]["btn_copy"] = $("btn-action-copy");
    this[name]["btn_select"] = $("btn-action-select");
    this[name]["btn_generate"] = $("btn-action-generate");
}, "complete");
