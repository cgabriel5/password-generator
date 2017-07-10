app.module("globals", function(modules, name) {
    // import whats needed
    // keep track of the options values
    var options = {
        // user stored generator options
        "user": {},
        // default generator option values
        "defaults": {
            "preferences": false,
            "ambiguous": true,
            "enclosures": true,
            "lowercase": true,
            "numbers": true,
            "punctuation": true,
            "similar": true,
            "spaces": false,
            "symbols": true,
            "uppercase": true,
            "hexonly": false,
            "plength": 20
        },
        // is the UI enabled or disabled?
        "UI_enabled": true,
        // generator active to churn out passwords?
        "active": false,
        // allowed to store options in localStorage?
        "store": false
    };
    // will contain HTMLElement option elements
    var $options = {};
    // the Monitor
    var monitor;
    // export to access in other modules
    this[name]["options"] = options;
    this[name]["$options"] = $options;
    this[name]["monitor"] = monitor;
}, "complete");
