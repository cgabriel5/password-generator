app.module("globals", function(modules, name) {
    // import whats needed
    // keep track of the options values
    var options = {
        "user": {},
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
    var $options = {};
    var monitor;
    // export to access in other modules
    this[name]["options"] = options;
    this[name]["$options"] = $options;
    this[name]["monitor"] = monitor;
}, "complete");
