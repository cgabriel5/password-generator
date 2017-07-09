(function() {
    "use strict";
    /**
     * @preserve FastClick: polyfill to remove click delays on browsers with touch UIs.
     *
     * @codingstandard ftlabs-jsv2
     * @copyright The Financial Times Limited [All Rights Reserved]
     * @license MIT License (see LICENSE.txt)
     */
    /*jslint browser:true, node:true*/
    /*global define, Event, Node*/
    /**
     * Instantiate fast-clicking listeners on the specified layer.
     *
     * @constructor
     * @param {Element} layer The layer to listen on
     * @param {Object} [options={}] The options to override the defaults
     */
    function FastClick(layer, options) {
        var oldOnClick;
        options = options || {};
        /**
         * Whether a click is currently being tracked.
         *
         * @type boolean
         */
        this.trackingClick = false;
        /**
         * Timestamp for when click tracking started.
         *
         * @type number
         */
        this.trackingClickStart = 0;
        /**
         * The element being tracked for a click.
         *
         * @type EventTarget
         */
        this.targetElement = null;
        /**
         * X-coordinate of touch start event.
         *
         * @type number
         */
        this.touchStartX = 0;
        /**
         * Y-coordinate of touch start event.
         *
         * @type number
         */
        this.touchStartY = 0;
        /**
         * ID of the last touch, retrieved from Touch.identifier.
         *
         * @type number
         */
        this.lastTouchIdentifier = 0;
        /**
         * Touchmove boundary, beyond which a click will be cancelled.
         *
         * @type number
         */
        this.touchBoundary = options.touchBoundary || 10;
        /**
         * The FastClick layer.
         *
         * @type Element
         */
        this.layer = layer;
        /**
         * The minimum time between tap(touchstart and touchend) events
         *
         * @type number
         */
        this.tapDelay = options.tapDelay || 200;
        /**
         * The maximum time for a tap
         *
         * @type number
         */
        this.tapTimeout = options.tapTimeout || 700;
        if (FastClick.notNeeded(layer)) {
            return;
        }
        // Some old versions of Android don't have Function.prototype.bind
        function bind(method, context) {
            return function() {
                return method.apply(context, arguments);
            };
        }
        var methods = ["onMouse", "onClick", "onTouchStart", "onTouchMove", "onTouchEnd", "onTouchCancel"];
        var context = this;
        for (var i = 0, l = methods.length; i < l; i++) {
            context[methods[i]] = bind(context[methods[i]], context);
        }
        // Set up event handlers as required
        if (deviceIsAndroid) {
            layer.addEventListener("mouseover", this.onMouse, true);
            layer.addEventListener("mousedown", this.onMouse, true);
            layer.addEventListener("mouseup", this.onMouse, true);
        }
        layer.addEventListener("click", this.onClick, true);
        layer.addEventListener("touchstart", this.onTouchStart, false);
        layer.addEventListener("touchmove", this.onTouchMove, false);
        layer.addEventListener("touchend", this.onTouchEnd, false);
        layer.addEventListener("touchcancel", this.onTouchCancel, false);
        // Hack is required for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
        // which is how FastClick normally stops click events bubbling to callbacks registered on the FastClick
        // layer when they are cancelled.
        if (!Event.prototype.stopImmediatePropagation) {
            layer.removeEventListener = function(type, callback, capture) {
                var rmv = Node.prototype.removeEventListener;
                if (type === "click") {
                    rmv.call(layer, type, callback.hijacked || callback, capture);
                } else {
                    rmv.call(layer, type, callback, capture);
                }
            };
            layer.addEventListener = function(type, callback, capture) {
                var adv = Node.prototype.addEventListener;
                if (type === "click") {
                    adv.call(layer, type, callback.hijacked || (callback.hijacked = function(event) {
                        if (!event.propagationStopped) {
                            callback(event);
                        }
                    }), capture);
                } else {
                    adv.call(layer, type, callback, capture);
                }
            };
        }
        // If a handler is already declared in the element's onclick attribute, it will be fired before
        // FastClick's onClick handler. Fix this by pulling out the user-defined handler function and
        // adding it as listener.
        if (typeof layer.onclick === "function") {
            // Android browser on at least 3.2 requires a new reference to the function in layer.onclick
            // - the old one won't work if passed to addEventListener directly.
            oldOnClick = layer.onclick;
            layer.addEventListener("click", function(event) {
                oldOnClick(event);
            }, false);
            layer.onclick = null;
        }
    }
    /**
     * Windows Phone 8.1 fakes user agent string to look like Android and iPhone.
     *
     * @type boolean
     */
    var deviceIsWindowsPhone = navigator.userAgent.indexOf("Windows Phone") >= 0;
    /**
     * Android requires exceptions.
     *
     * @type boolean
     */
    var deviceIsAndroid = navigator.userAgent.indexOf("Android") > 0 && !deviceIsWindowsPhone;
    /**
     * iOS requires exceptions.
     *
     * @type boolean
     */
    var deviceIsIOS = /iP(ad|hone|od)/.test(navigator.userAgent) && !deviceIsWindowsPhone;
    /**
     * iOS 4 requires an exception for select elements.
     *
     * @type boolean
     */
    var deviceIsIOS4 = deviceIsIOS && /OS 4_\d(_\d)?/.test(navigator.userAgent);
    /**
     * iOS 6.0-7.* requires the target element to be manually derived
     *
     * @type boolean
     */
    var deviceIsIOSWithBadTarget = deviceIsIOS && /OS [6-7]_\d/.test(navigator.userAgent);
    /**
     * BlackBerry requires exceptions.
     *
     * @type boolean
     */
    var deviceIsBlackBerry10 = navigator.userAgent.indexOf("BB10") > 0;
    /**
     * Determine whether a given element requires a native click.
     *
     * @param {EventTarget|Element} target Target DOM element
     * @returns {boolean} Returns true if the element needs a native click
     */
    FastClick.prototype.needsClick = function(target) {
        switch (target.nodeName.toLowerCase()) {
            // Don't send a synthetic click to disabled inputs (issue #62)
            case "button":
            case "select":
            case "textarea":
                if (target.disabled) {
                    return true;
                }
                break;
            case "input":
                // File inputs need real clicks on iOS 6 due to a browser bug (issue #68)
                if (
                    (deviceIsIOS && target.type === "file") || target.disabled) {
                    return true;
                }
                break;
            case "label":
            case "iframe": // iOS8 homescreen apps can prevent events bubbling into frames
            case "video":
                return true;
        }
        return /\bneedsclick\b/.test(target.className);
    };
    /**
     * Determine whether a given element requires a call to focus to simulate click into element.
     *
     * @param {EventTarget|Element} target Target DOM element
     * @returns {boolean} Returns true if the element requires a call to focus to simulate native click.
     */
    FastClick.prototype.needsFocus = function(target) {
        switch (target.nodeName.toLowerCase()) {
            case "textarea":
                return true;
            case "select":
                return !deviceIsAndroid;
            case "input":
                switch (target.type) {
                    case "button":
                    case "checkbox":
                    case "file":
                    case "image":
                    case "radio":
                    case "submit":
                        return false;
                }
                // No point in attempting to focus disabled inputs
                return !target.disabled && !target.readOnly;
            default:
                return /\bneedsfocus\b/.test(target.className);
        }
    };
    /**
     * Send a click event to the specified element.
     *
     * @param {EventTarget|Element} targetElement
     * @param {Event} event
     */
    FastClick.prototype.sendClick = function(targetElement, event) {
        var clickEvent, touch;
        // On some Android devices activeElement needs to be blurred otherwise the synthetic click will have no effect (#24)
        if (document.activeElement && document.activeElement !== targetElement) {
            document.activeElement.blur();
        }
        touch = event.changedTouches[0];
        // Synthesise a click event, with an extra attribute so it can be tracked
        clickEvent = document.createEvent("MouseEvents");
        clickEvent.initMouseEvent(this.determineEventType(targetElement), true, true, window, 1, touch.screenX, touch.screenY, touch.clientX, touch.clientY, false, false, false, false, 0, null);
        clickEvent.forwardedTouchEvent = true;
        targetElement.dispatchEvent(clickEvent);
    };
    FastClick.prototype.determineEventType = function(targetElement) {
        //Issue #159: Android Chrome Select Box does not open with a synthetic click event
        if (deviceIsAndroid && targetElement.tagName.toLowerCase() === "select") {
            return "mousedown";
        }
        return "click";
    };
    /**
     * @param {EventTarget|Element} targetElement
     */
    FastClick.prototype.focus = function(targetElement) {
        var length;
        // Issue #160: on iOS 7, some input elements (e.g. date datetime month) throw a vague TypeError on setSelectionRange. These elements don't have an integer value for the selectionStart and selectionEnd properties, but unfortunately that can't be used for detection because accessing the properties also throws a TypeError. Just check the type instead. Filed as Apple bug #15122724.
        if (deviceIsIOS && targetElement.setSelectionRange && targetElement.type.indexOf("date") !== 0 && targetElement.type !== "time" && targetElement.type !== "month") {
            length = targetElement.value.length;
            targetElement.setSelectionRange(length, length);
        } else {
            targetElement.focus();
        }
    };
    /**
     * Check whether the given target element is a child of a scrollable layer and if so, set a flag on it.
     *
     * @param {EventTarget|Element} targetElement
     */
    FastClick.prototype.updateScrollParent = function(targetElement) {
        var scrollParent, parentElement;
        scrollParent = targetElement.fastClickScrollParent;
        // Attempt to discover whether the target element is contained within a scrollable layer. Re-check if the
        // target element was moved to another parent.
        if (!scrollParent || !scrollParent.contains(targetElement)) {
            parentElement = targetElement;
            do {
                if (parentElement.scrollHeight > parentElement.offsetHeight) {
                    scrollParent = parentElement;
                    targetElement.fastClickScrollParent = parentElement;
                    break;
                }
                parentElement = parentElement.parentElement;
            } while (parentElement);
        }
        // Always update the scroll top tracker if possible.
        if (scrollParent) {
            scrollParent.fastClickLastScrollTop = scrollParent.scrollTop;
        }
    };
    /**
     * @param {EventTarget} targetElement
     * @returns {Element|EventTarget}
     */
    FastClick.prototype.getTargetElementFromEventTarget = function(eventTarget) {
        // On some older browsers (notably Safari on iOS 4.1 - see issue #56) the event target may be a text node.
        if (eventTarget.nodeType === Node.TEXT_NODE) {
            return eventTarget.parentNode;
        }
        return eventTarget;
    };
    /**
     * On touch start, record the position and scroll offset.
     *
     * @param {Event} event
     * @returns {boolean}
     */
    FastClick.prototype.onTouchStart = function(event) {
        var targetElement, touch, selection;
        // Ignore multiple touches, otherwise pinch-to-zoom is prevented if both fingers are on the FastClick element (issue #111).
        if (event.targetTouches.length > 1) {
            return true;
        }
        targetElement = this.getTargetElementFromEventTarget(event.target);
        touch = event.targetTouches[0];
        if (deviceIsIOS) {
            // Only trusted events will deselect text on iOS (issue #49)
            selection = window.getSelection();
            if (selection.rangeCount && !selection.isCollapsed) {
                return true;
            }
            if (!deviceIsIOS4) {
                // Weird things happen on iOS when an alert or confirm dialog is opened from a click event callback (issue #23):
                // when the user next taps anywhere else on the page, new touchstart and touchend events are dispatched
                // with the same identifier as the touch event that previously triggered the click that triggered the alert.
                // Sadly, there is an issue on iOS 4 that causes some normal touch events to have the same identifier as an
                // immediately preceeding touch event (issue #52), so this fix is unavailable on that platform.
                // Issue 120: touch.identifier is 0 when Chrome dev tools 'Emulate touch events' is set with an iOS device UA string,
                // which causes all touch events to be ignored. As this block only applies to iOS, and iOS identifiers are always long,
                // random integers, it's safe to to continue if the identifier is 0 here.
                if (touch.identifier && touch.identifier === this.lastTouchIdentifier) {
                    event.preventDefault();
                    return false;
                }
                this.lastTouchIdentifier = touch.identifier;
                // If the target element is a child of a scrollable layer (using -webkit-overflow-scrolling: touch) and:
                // 1) the user does a fling scroll on the scrollable layer
                // 2) the user stops the fling scroll with another tap
                // then the event.target of the last 'touchend' event will be the element that was under the user's finger
                // when the fling scroll was started, causing FastClick to send a click event to that layer - unless a check
                // is made to ensure that a parent layer was not scrolled before sending a synthetic click (issue #42).
                this.updateScrollParent(targetElement);
            }
        }
        this.trackingClick = true;
        this.trackingClickStart = event.timeStamp;
        this.targetElement = targetElement;
        this.touchStartX = touch.pageX;
        this.touchStartY = touch.pageY;
        // Prevent phantom clicks on fast double-tap (issue #36)
        if (event.timeStamp - this.lastClickTime < this.tapDelay) {
            event.preventDefault();
        }
        return true;
    };
    /**
     * Based on a touchmove event object, check whether the touch has moved past a boundary since it started.
     *
     * @param {Event} event
     * @returns {boolean}
     */
    FastClick.prototype.touchHasMoved = function(event) {
        var touch = event.changedTouches[0],
            boundary = this.touchBoundary;
        if (Math.abs(touch.pageX - this.touchStartX) > boundary || Math.abs(touch.pageY - this.touchStartY) > boundary) {
            return true;
        }
        return false;
    };
    /**
     * Update the last position.
     *
     * @param {Event} event
     * @returns {boolean}
     */
    FastClick.prototype.onTouchMove = function(event) {
        if (!this.trackingClick) {
            return true;
        }
        // If the touch has moved, cancel the click tracking
        if (this.targetElement !== this.getTargetElementFromEventTarget(event.target) || this.touchHasMoved(event)) {
            this.trackingClick = false;
            this.targetElement = null;
        }
        return true;
    };
    /**
     * Attempt to find the labelled control for the given label element.
     *
     * @param {EventTarget|HTMLLabelElement} labelElement
     * @returns {Element|null}
     */
    FastClick.prototype.findControl = function(labelElement) {
        // Fast path for newer browsers supporting the HTML5 control attribute
        if (labelElement.control !== undefined) {
            return labelElement.control;
        }
        // All browsers under test that support touch events also support the HTML5 htmlFor attribute
        if (labelElement.htmlFor) {
            return document.getElementById(labelElement.htmlFor);
        }
        // If no for attribute exists, attempt to retrieve the first labellable descendant element
        // the list of which is defined here: http://www.w3.org/TR/html5/forms.html#category-label
        return labelElement.querySelector("button, input:not([type=hidden]), keygen, meter, output, progress, select, textarea");
    };
    /**
     * On touch end, determine whether to send a click event at once.
     *
     * @param {Event} event
     * @returns {boolean}
     */
    FastClick.prototype.onTouchEnd = function(event) {
        var forElement,
            trackingClickStart,
            targetTagName,
            scrollParent,
            touch,
            targetElement = this.targetElement;
        if (!this.trackingClick) {
            return true;
        }
        // Prevent phantom clicks on fast double-tap (issue #36)
        if (event.timeStamp - this.lastClickTime < this.tapDelay) {
            this.cancelNextClick = true;
            return true;
        }
        if (event.timeStamp - this.trackingClickStart > this.tapTimeout) {
            return true;
        }
        // Reset to prevent wrong click cancel on input (issue #156).
        this.cancelNextClick = false;
        this.lastClickTime = event.timeStamp;
        trackingClickStart = this.trackingClickStart;
        this.trackingClick = false;
        this.trackingClickStart = 0;
        // On some iOS devices, the targetElement supplied with the event is invalid if the layer
        // is performing a transition or scroll, and has to be re-detected manually. Note that
        // for this to function correctly, it must be called *after* the event target is checked!
        // See issue #57; also filed as rdar://13048589 .
        if (deviceIsIOSWithBadTarget) {
            touch = event.changedTouches[0];
            // In certain cases arguments of elementFromPoint can be negative, so prevent setting targetElement to null
            targetElement = document.elementFromPoint(touch.pageX - window.pageXOffset, touch.pageY - window.pageYOffset) || targetElement;
            targetElement.fastClickScrollParent = this.targetElement.fastClickScrollParent;
        }
        targetTagName = targetElement.tagName.toLowerCase();
        if (targetTagName === "label") {
            forElement = this.findControl(targetElement);
            if (forElement) {
                this.focus(targetElement);
                if (deviceIsAndroid) {
                    return false;
                }
                targetElement = forElement;
            }
        } else if (this.needsFocus(targetElement)) {
            // Case 1: If the touch started a while ago (best guess is 100ms based on tests for issue #36) then focus will be triggered anyway. Return early and unset the target element reference so that the subsequent click will be allowed through.
            // Case 2: Without this exception for input elements tapped when the document is contained in an iframe, then any inputted text won't be visible even though the value attribute is updated as the user types (issue #37).
            if (event.timeStamp - trackingClickStart > 100 || (deviceIsIOS && window.top !== window && targetTagName === "input")) {
                this.targetElement = null;
                return false;
            }
            this.focus(targetElement);
            this.sendClick(targetElement, event);
            // Select elements need the event to go through on iOS 4, otherwise the selector menu won't open.
            // Also this breaks opening selects when VoiceOver is active on iOS6, iOS7 (and possibly others)
            if (!deviceIsIOS || targetTagName !== "select") {
                this.targetElement = null;
                event.preventDefault();
            }
            return false;
        }
        if (deviceIsIOS && !deviceIsIOS4) {
            // Don't send a synthetic click event if the target element is contained within a parent layer that was scrolled
            // and this tap is being used to stop the scrolling (usually initiated by a fling - issue #42).
            scrollParent = targetElement.fastClickScrollParent;
            if (scrollParent && scrollParent.fastClickLastScrollTop !== scrollParent.scrollTop) {
                return true;
            }
        }
        // Prevent the actual click from going though - unless the target node is marked as requiring
        // real clicks or if it is in the whitelist in which case only non-programmatic clicks are permitted.
        if (!this.needsClick(targetElement)) {
            event.preventDefault();
            this.sendClick(targetElement, event);
        }
        return false;
    };
    /**
     * On touch cancel, stop tracking the click.
     *
     * @returns {void}
     */
    FastClick.prototype.onTouchCancel = function() {
        this.trackingClick = false;
        this.targetElement = null;
    };
    /**
     * Determine mouse events which should be permitted.
     *
     * @param {Event} event
     * @returns {boolean}
     */
    FastClick.prototype.onMouse = function(event) {
        // If a target element was never set (because a touch event was never fired) allow the event
        if (!this.targetElement) {
            return true;
        }
        if (event.forwardedTouchEvent) {
            return true;
        }
        // Programmatically generated events targeting a specific element should be permitted
        if (!event.cancelable) {
            return true;
        }
        // Derive and check the target element to see whether the mouse event needs to be permitted;
        // unless explicitly enabled, prevent non-touch click events from triggering actions,
        // to prevent ghost/doubleclicks.
        if (!this.needsClick(this.targetElement) || this.cancelNextClick) {
            // Prevent any user-added listeners declared on FastClick element from being fired.
            if (event.stopImmediatePropagation) {
                event.stopImmediatePropagation();
            } else {
                // Part of the hack for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
                event.propagationStopped = true;
            }
            // Cancel the event
            event.stopPropagation();
            event.preventDefault();
            return false;
        }
        // If the mouse event is permitted, return true for the action to go through.
        return true;
    };
    /**
     * On actual clicks, determine whether this is a touch-generated click, a click action occurring
     * naturally after a delay after a touch (which needs to be cancelled to avoid duplication), or
     * an actual click which should be permitted.
     *
     * @param {Event} event
     * @returns {boolean}
     */
    FastClick.prototype.onClick = function(event) {
        var permitted;
        // It's possible for another FastClick-like library delivered with third-party code to fire a click event before FastClick does (issue #44). In that case, set the click-tracking flag back to false and return early. This will cause onTouchEnd to return early.
        if (this.trackingClick) {
            this.targetElement = null;
            this.trackingClick = false;
            return true;
        }
        // Very odd behaviour on iOS (issue #18): if a submit element is present inside a form and the user hits enter in the iOS simulator or clicks the Go button on the pop-up OS keyboard the a kind of 'fake' click event will be triggered with the submit-type input element as the target.
        if (event.target.type === "submit" && event.detail === 0) {
            return true;
        }
        permitted = this.onMouse(event);
        // Only unset targetElement if the click is not permitted. This will ensure that the check for !targetElement in onMouse fails and the browser's click doesn't go through.
        if (!permitted) {
            this.targetElement = null;
        }
        // If clicks are permitted, return true for the action to go through.
        return permitted;
    };
    /**
     * Remove all FastClick's event listeners.
     *
     * @returns {void}
     */
    FastClick.prototype.destroy = function() {
        var layer = this.layer;
        if (deviceIsAndroid) {
            layer.removeEventListener("mouseover", this.onMouse, true);
            layer.removeEventListener("mousedown", this.onMouse, true);
            layer.removeEventListener("mouseup", this.onMouse, true);
        }
        layer.removeEventListener("click", this.onClick, true);
        layer.removeEventListener("touchstart", this.onTouchStart, false);
        layer.removeEventListener("touchmove", this.onTouchMove, false);
        layer.removeEventListener("touchend", this.onTouchEnd, false);
        layer.removeEventListener("touchcancel", this.onTouchCancel, false);
    };
    /**
     * Check whether FastClick is needed.
     *
     * @param {Element} layer The layer to listen on
     */
    FastClick.notNeeded = function(layer) {
        var metaViewport;
        var chromeVersion;
        var blackberryVersion;
        var firefoxVersion;
        // Devices that don't support touch don't need FastClick
        if (typeof window.ontouchstart === "undefined") {
            return true;
        }
        // Chrome version - zero for other browsers
        chromeVersion = +(/Chrome\/([0-9]+)/.exec(navigator.userAgent) || [,
            0
        ])[1];
        if (chromeVersion) {
            if (deviceIsAndroid) {
                metaViewport = document.querySelector("meta[name=viewport]");
                if (metaViewport) {
                    // Chrome on Android with user-scalable="no" doesn't need FastClick (issue #89)
                    if (metaViewport.content.indexOf("user-scalable=no") !== -1) {
                        return true;
                    }
                    // Chrome 32 and above with width=device-width or less don't need FastClick
                    if (chromeVersion > 31 && document.documentElement.scrollWidth <= window.outerWidth) {
                        return true;
                    }
                }
                // Chrome desktop doesn't need FastClick (issue #15)
            } else {
                return true;
            }
        }
        if (deviceIsBlackBerry10) {
            blackberryVersion = navigator.userAgent.match(/Version\/([0-9]*)\.([0-9]*)/);
            // BlackBerry 10.3+ does not require Fastclick library.
            // https://github.com/ftlabs/fastclick/issues/251
            if (blackberryVersion[1] >= 10 && blackberryVersion[2] >= 3) {
                metaViewport = document.querySelector("meta[name=viewport]");
                if (metaViewport) {
                    // user-scalable=no eliminates click delay.
                    if (metaViewport.content.indexOf("user-scalable=no") !== -1) {
                        return true;
                    }
                    // width=device-width (or less than device-width) eliminates click delay.
                    if (document.documentElement.scrollWidth <= window.outerWidth) {
                        return true;
                    }
                }
            }
        }
        // IE10 with -ms-touch-action: none or manipulation, which disables double-tap-to-zoom (issue #97)
        if (layer.style.msTouchAction === "none" || layer.style.touchAction === "manipulation") {
            return true;
        }
        // Firefox version - zero for other browsers
        firefoxVersion = +(/Firefox\/([0-9]+)/.exec(navigator.userAgent) || [,
            0
        ])[1];
        if (firefoxVersion >= 27) {
            // Firefox 27+ does not have tap delay if the content is not zoomable - https://bugzilla.mozilla.org/show_bug.cgi?id=922896
            metaViewport = document.querySelector("meta[name=viewport]");
            if (metaViewport && (metaViewport.content.indexOf("user-scalable=no") !== -1 || document.documentElement.scrollWidth <= window.outerWidth)) {
                return true;
            }
        }
        // IE11: prefixed -ms-touch-action is no longer supported and it's recomended to use non-prefixed version
        // http://msdn.microsoft.com/en-us/library/windows/apps/Hh767313.aspx
        if (layer.style.touchAction === "none" || layer.style.touchAction === "manipulation") {
            return true;
        }
        return false;
    };
    /**
     * Factory method for creating a FastClick object
     *
     * @param {Element} layer The layer to listen on
     * @param {Object} [options={}] The options to override the defaults
     */
    FastClick.attach = function(layer, options) {
        return new FastClick(layer, options);
    };
    if (typeof define === "function" && typeof define.amd === "object" && define.amd) {
        // AMD. Register as an anonymous module.
        define(function() {
            return FastClick;
        });
    } else if (typeof module !== "undefined" && module.exports) {
        module.exports = FastClick.attach;
        module.exports.FastClick = FastClick;
    } else {
        window.FastClick = FastClick;
    }
})();
// IIFE start
(function(window) {
    "use strict";
    var library = (function() {
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
        // =============================== Core Library Functions
        /**
         * @description [Main function runs the generator function. Main function
         *               also gets attached to the global scope.]
         * @param  {Object} options [The user's provided options, if any.]
         * @return {String}         [The generated string]
         */
        function main(options) {
            // make and return random string
            return generator(normalized(options));
        }
        /**
         * @description [Generates string.]
         * @param  {Object} options [The user's provided options, if any.]
         * @return {String}         [The generated string]
         */
        function generator(options) {
            // create the charset
            var charset = build_charset(options);
            // generate normal random string
            if (!options.format) {
                // get the user provided string length
                var length = options.length;
                var string = [];
                // start building string...
                while (length >= 1) {
                    // shuffle array
                    string.push(random_item(shuffle(charset)));
                    length--;
                }
                return string.join("");
            } else { // user provided a format the string should be in
                var format_chars = options.format.split("");
                // loop over format chars, replacing all ?'s with a random character
                for (var i = 0, l = format_chars.length; i < l; i++) {
                    // replace question mark with random char
                    if (format_chars[i] === "?") format_chars[i] = random_item(shuffle(charset));
                }
                return format_chars.join("");
            }
        }
        /**
         * @description [Normalizes the library options.]
         * @param  {Object} options [The user's provided options, if any.]
         * @return {Object}         [Object containing normalized options.]
         */
        function normalized(options) {
            return Object.assign({
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
                "format": false,
                "charset": false,
                "include": false,
                "exclude": false,
                "length": 20
            }, options || {});
        }
        /**
         * @description [Builds the usable character set. This depends on the options the user specified.]
         * @param  {Object} options [The user's provided options, if any.]
         * @return {Array} [An array containing all possible characters to build string from.]
         */
        function build_charset(options) {
            // if charset is provided use that instead
            if (options.charset) return _cludes(options, options.charset)
                .split("");
            // cache options
            var ambiguous = options.ambiguous,
                enclosures = options.enclosures,
                lowercase = options.lowercase,
                numbers = options.numbers,
                punctuation = options.punctuation,
                similar = options.similar,
                spaces = options.spaces,
                symbols = options.symbols,
                uppercase = options.uppercase,
                hexonly = options.hexonly;
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
            // when hexonly option is on only return hex characters
            if (hexonly) string = (charset_numbers + "ABCDEF");
            // finally return the built string in an array
            return _cludes(options, string)
                .split("");
        }
        /**
         * @description [Adds includes characters and removes exclude characters from the charset.]
         * @param  {Object} options [The user's provided options, if any.]
         * @param  {String} options [The charset.]
         * @return {String} [The modified charset.]
         */
        function _cludes(options, string) {
            // get the includes/excludes from the options
            var includes = options.include;
            var excludes = options.exclude;
            // remove excludes if provided
            if (excludes) {
                var excludes_array = excludes.split("");
                for (var i = 0, l = excludes_array.length; i < l; i++) {
                    string = string.replace(new RegExp(excludes_array[i], "g"), "");
                }
            }
            // add the includes if provided
            if (includes) string += includes;
            return string; // return modified charset
        }
        // return library to add to global scope later...
        return main;
    })();
    // =============================== Global Library Functions/Methods/Vars
    // =============================== Attach Library To Global Scope
    // add to global scope for ease of use
    // use global app var or create it if not present
    var app = window.app || (window.app = {});
    // get the libs object from within the app object
    // if it does not exist create it
    var libs = app.libs || (app.libs = {});
    // add the library to the libs object
    libs.randomString = library;
    // IIFE end
})(window);
// IIFE start
(function(window) {
    "use strict";
    var library = (function() {
        // =============================== Helper Functions
        /**
         * @description [Generates a simple ID containing letters and numbers.]
         * @param  {Number} length [The length the ID should be. Max length is 22 characters]
         * @return {String}        [The newly generated ID.]
         * @source {http://stackoverflow.com/a/38622545}
         */
        function id(length) {
            return Math.random()
                .toString(36)
                .substr(2, length);
        }
        /**
         * @description [Returns index of given value in provided array.]
         * @param  {Array}    array [The array to check against.]
         * @param  {Integer}  value [The value to check.]
         * @return {Integer}        [Returns the index value. -1 if not in array.]
         */
        function index(array, value) {
            return array.indexOf(value);
        }
        /**
         * @description [Checks if the given value is in provided array or string.]
         * @param  {Array|String}   iterable [The array or string to check against.]
         * @param  {Any}            value    [The value to check.]
         * @return {Boolean}                 [description]
         * @source [https://www.joezimjs.com/javascript/great-mystery-of-the-tilde/]
         * @source [http://stackoverflow.com/questions/12299665/what-does-a-tilde-do-
         * when-it-precedes-an-expression/12299717#12299717]
         */
        function includes(iterable, value) {
            return -~index(iterable, value);
        }
        /**
         * @description [Checks if the provided index exists.]
         * @param  {Number} index [The index (number) to check.]
         * @return {Boolean}       [False if -1. Otherwise, true.]
         */
        function indexed(index) {
            return -~index ? true : false;
        }
        /**
         * @description [Makes an Array from an array like object (ALO). ALO must have a length property
         *               for it to work.]
         * @param  {ALO} alo [The ALO.]
         * @return {Array}   [The created array.]
         */
        function to_array(alo) {
            // vars
            var true_array = [];
            // loop through ALO and pushing items into true_array
            for (var i = 0, l = alo.length; i < l; i++) true_array.push(alo[i]);
            return true_array;
        }
        /**
         * @description [Returns the data type of the provided object.]
         * @param  {Any} object [The object to check.]
         * @return {String}    [The data type of the checked object.]
         */
        var dtype = function(object) {
            // will always return something like "[object {type}]"
            return Object.prototype.toString.call(object)
                .replace(/(\[object |\])/g, "")
                .toLowerCase();
        };
        /**
         * @description [Check if the provided object is of the provided data types.]
         * @param  {Any} object [The object to check.]
         * @param  {String}  types  [The allowed data type the object may be.]
         * @return {Boolean}        [Boolean indicating whether the object is of the
         *                           allowed data types.]
         */
        dtype.is = function(object, types) {
            // get the object type
            var type = this(object);
            // prepare the types
            types = "|" + types.toLowerCase()
                .trim() + "|";
            // check if the object's type is in the list
            return Boolean(-~types.indexOf("|" + type + "|"));
        };
        /**
         * @description [Check if the provided object is not of the provided data types.]
         * @param  {Any} object [The object to check.]
         * @param  {String}  types  [The prohibited data types.]
         * @return {Boolean}        [Boolean indicating whether the object is not of the
         *                           allowed data types.]
         */
        dtype.isnot = function(object, types) {
            // return the inverse of the is method
            return !this.is(object, types);
        };
        /**
         * @description [A class wrapper. Creates a class based on provided object containing class constructor__ and methods__.
         *               If class needs to extend another, provide it under the extend__ property.]
         * @param  {Object} cobject [The class object containing three properties: constructor__, methods__, and extend__.
         *                           .constructor__ {Function}       [The class constructor]
         *                           .methods__     {Object}         [Object containing class methods.]
         *                           .extend__      {Boolean|Object} [Set to false if does not need to extend. Otherwise, provide the
         *                                                            class to extend.]
         *                           ]
         * @return {Function}         [Returns class constructor.]
         */
        function class__(cobject) {
            // cache class data
            var constructor = cobject.constructor__,
                methods = cobject.methods__,
                parent = cobject.extend__;
            // extend if parent class provided
            if (parent) {
                constructor.prototype = Object.create(parent.prototype);
                constructor.prototype.constructor = constructor;
            }
            // cache prototype
            var prototype = constructor.prototype;
            // add class methods to prototype
            for (var method in methods) {
                if (methods.hasOwnProperty(method)) {
                    prototype[method] = methods[method];
                }
            }
            return constructor;
        }
        // =============================== Core Library Functions
        // /**
        //  * @description [Checks if the supplied arrays have any items in common, or intersect.]
        //  * @param  {Array}   array1 [The first array to perform comparison with.]
        //  * @param  {Array}   array2 [The second array to perform comparison with.]
        //  * @return {Boolean}        [description]
        //  */
        // function intersect(array1, array2) {
        //     // define vars
        //     var short_array = array1,
        //         long_array = array2,
        //         i = 0,
        //         l, a1_len = array1.length,
        //         a2_len = array2.length;
        //     // reset short and long arrays if arrays are equal in...
        //     // ...length or if length of first array is less than that...
        //     // ...of the second one.
        //     if (a1_len === a2_len || a1_len < a2_len) {
        //         short_array = array2;
        //         long_array = array1;
        //     }
        //     // use length of short array as the last iteration stop.
        //     // finally, check if arrays have anything in common.
        //     // returning true if a commonality is found. otherwise return false
        //     l = short_array.length;
        //     for (; i < l; i++)
        //         if (includes(long_array, short_array[i])) return true;
        //     return false;
        // }
        /**
         * @description [Internal helper function. Is used when the "tags", "classes", or "text" filters are invoked.]
         * @param  {Array}          this_ [The Library object.]
         * @param  {String}         type  [The name of the filter being passed. (i.e. tags|classes|text)]
         * @param  {ArgumentsArray} args  [The passed in arguments object.]
         * @return {Array}                [Returns the filtered element collection stack.]
         */
        var helper_one = function(this_, type, args) {
            var elements,
                array = this_.stack[this_.stack.length - 1],
                /**
                 * @description [Cleans the provided tags into has and nothas arrays]
                 * @param  {Array}  args [The array of tags provided, both has and nothas]
                 * @return {Object}      [An object containing the cleaned tags]
                 */
                input = function(args) {
                    // loop through arguments and seprate between has and nots
                    // i.e. -> ["!input", "canvas"] -> has:["canvas"], not:["input"]
                    for (var has = [], not = [], current_item, i = 0, l = args.length; i < l; i++) {
                        current_item = args[i];
                        (current_item.charCodeAt(0) !== 33) ? has.push(current_item): not.push(current_item.substring(1));
                    }
                    return {
                        "has": has,
                        "not": not
                    };
                },
                /**
                 * @description [Filters element stack with either tags|text|classes filters.]
                 * @param  {Array}    elements [The elements stack to filter.]
                 * @param  {Array}    has_not  [The array of tags|text|classes to filter against.]
                 * @param  {Function} filter   [The filter function to use.]
                 * @param  {Boolean}  reverse  [Reverse for not use (!).]
                 * @return {Array}             [The filtered elements.]
                 */
                has = function(elements, has_not, filter, reverse) {
                    for (var current_element, filtered = [], i = 0, l = elements.length; i < l; i++) {
                        current_element = elements[i];
                        if (filter(current_element, has_not, reverse)) filtered.push(current_element);
                    }
                    return filtered;
                },
                filters = {
                    /**
                     * @description [Checks whether element is of the wanted tag type.]
                     * @param  {Element}  element [The element to check.]
                     * @param  {Array} has_not [The array of tags to check with.]
                     * @param  {Boolean}  reverse [If provided, reverses check. Used for not (!).]
                     * @return {Boolean|Undefined}
                     */
                    "tags": function(element, has_not, reverse) {
                        var check = includes(has_not, element.tagName.toLowerCase());
                        // reverse for the not checks
                        if (reverse) check = !check;
                        if (check) return true;
                    },
                    /**
                     * @description [Checks whether element contains provided text(s) (substrings).]
                     * @param  {Element}  element [The element to check.]
                     * @param  {Array} has_not [The array of substrings to check with.]
                     * @param  {Boolean}  reverse [If provided, reverses check. Used for not (!).]
                     * @return {Boolean|Undefined}
                     */
                    "text": function(element, has_not, reverse) {
                        for (var current_text, i = 0, l = has_not.length; i < l; i++) {
                            current_text = has_not[i];
                            var text_content = element.textContent.trim();
                            // text content must not be empty
                            if (text_content === "") continue;
                            var check = includes(text_content, current_text);
                            // reverse for the not checks
                            if (reverse) check = !check;
                            if (!check) return; // fails to have a class we return
                            if (i === l - 1) return true; // must have all substrings provided,
                        }
                    },
                    /**
                     * @description [Checks whether element has wanted classes.]
                     * @param  {Element}  element [The element to check.]
                     * @param  {Array} has_not [The array of classes to check with.]
                     * @param  {Boolean}  reverse [If provided, reverses check. Used for not (!).]
                     * @return {Boolean|Undefined}
                     */
                    "classes": function(element, has_not, reverse) {
                        for (var current_class, i = 0, l = has_not.length; i < l; i++) {
                            current_class = has_not[i];
                            var check = includes((" " + element.className + " "), (" " + current_class + " "));
                            // reverse for the not checks
                            if (reverse) check = !check;
                            if (!check) return; // fails to have a class we return
                            if (i === l - 1) return true; // must have all classes provided,
                            // if last check and has class
                        }
                    }
                };
            // clean arguments
            var cleaned_input = input(args);
            // filter elements
            if (cleaned_input.has.length) elements = has(array, cleaned_input.has, filters[type]);
            if (cleaned_input.not.length) elements = has((elements || array), cleaned_input.not, filters[type], true /*reverse check*/ );
            return elements;
        };
        // =============================== Library Class
        var Library = class__({
            // class constructor
            "constructor__": function() {
                // cache arguments object
                var args = arguments;
                // not source points give warning and return
                if (!args) return console.warn("No source point(s) provided.");
                // if user does not invoke library with new keyword we use it for them by
                // returning a new instance of the library with the new keyword.
                if (!(this instanceof Library)) return new Library(true, args);
                // check if new keywords applied recursively:
                // when the new keywords is not used the arguments get passed into a new Library object.
                // this, the next time around, puts the arguments inside an array and therefore the following
                // time the arguments are accesses they are messed up. This check looks to find whether the
                // new keyword was recursively used. If so, the true arguments are reset to args[1].
                var is_recursive = (args[0] === true && dtype(args[1], "arguments"));
                // get elements from source points
                var points = to_array(is_recursive ? args[1] : args),
                    elements = [],
                    data_type,
                    point, parts, cid;
                // loop over all source points, get descendants is :all is supplied
                for (var i = 0, l = points.length; i < l; i++) {
                    // cache the current source point, i.e. -> #red:all or DOMElement
                    point = points[i];
                    // get the data type of the point
                    data_type = dtype(point);
                    // check whether the point is a string or an element
                    if (data_type === "string") {
                        point = point.trim();
                        parts = point.split(":"); // -> ["#red", "all"]
                        cid = document.getElementById(parts[0].replace(/^\#/, ""));
                        if (!cid) continue; // no element with ID found...skip iteration
                        // part[1] is the filer. when no filter is applied we add the
                        // source point directly to elements array
                        if (!parts[1]) elements = elements.concat([cid]);
                        // else apply the filter and add all returned (filtered) elements to array
                        else elements = elements.concat(to_array(this[parts[1]]([cid]))); // i.e. -> this.all()
                    } else if (/^html/.test(data_type)) { // the point is a DOMElement
                        // **Note: the selector can also take in raw element nodes (elements)
                        // it can take N amount of DOM nodes. for example, using
                        // Google Chrome's console this is a valid use case:
                        // var a = Funnel($0, $1); Where $<number> represents an element from
                        // the DOM. what is $0? => {https://willd.me/posts/0-in-chrome-dev-tools}
                        // add the element point to the elements array
                        elements = elements.concat([point]);
                    }
                }
                // add object properties
                this.stack = [elements]; // add elements to the object
                this.length = elements.length;
            },
            // class methods
            "methods__": {
                /**
                 * @description [Gets all elements from source point.]
                 * @param  {Array}  source [A source point element contained in an array. **Source parameter
                 *                          is only present when running the constructor. Chaining methods
                 *                          does not provide the source parameter. Thus allowing the method to
                 *                          be chainable.]
                 * @return {Array|Object}  [Return elements array if invoked from constructor. Otherwise return
                 *                          self to allow method chaining.]
                 */
                "all": function(source) {
                    // define vars
                    var elements = [],
                        this_ = this,
                        l = (source) ? source.length : this_.length,
                        array = (source) ? source : this_.stack[this_.stack.length - 1];
                    // loop through source and get all its elements
                    for (var i = 0; i < l; i++) {
                        elements = elements.concat(to_array(array[i].getElementsByTagName("*")));
                    }
                    // only returns for constructor
                    if (source) return elements;
                    // add elements to the object
                    this_.stack.push(elements);
                    this_.length = elements.length;
                    return this_;
                },
                /**
                 * @description [Gets text node elements of current stack.]
                 * @param  {Array}  source [A source point element contained in an array. **Source parameter
                 *                          is only present when running the constructor. Chaining methods
                 *                          does not provide the source parameter. Thus allowing the method to
                 *                          be chainable.]
                 * @return {Array|Object}  [Return elements array if invoked from constructor. Otherwise return
                                            self to allow method chaining.]
                 */
                "textNodes": function(source) {
                    // define vars
                    var elements = [],
                        this_ = this,
                        l = (source) ? source.length : this_.length,
                        array = (source) ? source : this_.stack[this_.stack.length - 1];
                    // loop through the elements and get the current element's children while screening only for text nodes.
                    for (var current_element, child_nodes, i = 0; i < l; i++) {
                        current_element = array[i];
                        child_nodes = current_element.childNodes;
                        for (var j = 0, ll = child_nodes.length; j < ll; j++) {
                            if (child_nodes[j].nodeType === 3 && child_nodes[j].textContent.trim()
                                .length) elements.push(child_nodes[j]);
                        }
                    }
                    // only returns for constructor
                    if (source) return elements;
                    // add elements to the object
                    this_.stack.push(elements);
                    this_.length = elements.length;
                    return this_;
                },
                /**
                 * @description [Get the parent node of all elements in stack.]
                 * @param  {Array}  source [A source point element contained in an array. **Source parameter
                 *                          is only present when running the constructor. Chaining methods
                 *                          does not provide the source parameter. Thus allowing the method to
                 *                          be chainable.]
                 * @return {Array|Object}  [Return elements array if invoked from constructor. Otherwise return
                                            self to allow method chaining.]
                 */
                "parent": function(source) {
                    // define vars
                    var elements = [],
                        this_ = this,
                        l = (source) ? source.length : this_.length,
                        array = (source) ? source : this_.stack[this_.stack.length - 1];
                    // loop through the elements getting their parents. only the first parent is gotten.
                    for (var i = 0; i < l; i++) {
                        elements.push(array[i].parentNode);
                    }
                    // only returns for constructor
                    if (source) return elements;
                    // add elements to the object
                    this_.stack.push(elements);
                    this_.length = elements.length;
                    return this_;
                },
                /**
                 * @description [Get all parent nodes of all elements in stack.]
                 * @param  {Array}  source [A source point element contained in an array. **Source parameter
                 *                          is only present when running the constructor. Chaining methods
                 *                          does not provide the source parameter. Thus allowing the method to
                 *                          be chainable.]
                 * @return {Array|Object}  [Return elements array if invoked from constructor. Otherwise return
                                            self to allow method chaining.]
                 */
                "parents": function(source) {
                    // define vars
                    var elements = [],
                        this_ = this,
                        l = (source) ? source.length : this_.length,
                        array = (source) ? source : this_.stack[this_.stack.length - 1];
                    // loop through the elements getting all their parents.
                    for (var current_element, i = 0; i < l; i++) {
                        current_element = array[i];
                        while (current_element) {
                            current_element = current_element.parentNode;
                            if (current_element) elements.push(current_element);
                        }
                    }
                    // only returns for constructor
                    if (source) return elements;
                    // add elements to the object
                    this_.stack.push(elements);
                    this_.length = elements.length;
                    return this_;
                },
                /**
                 * @description [Get all the children of elements in stack.]
                 * @param  {Array}  source [A source point element contained in an array. **Source parameter
                 *                          is only present when running the constructor. Chaining methods
                 *                          does not provide the source parameter. Thus allowing the method to
                 *                          be chainable.]
                 * @return {Array|Object}  [Return elements array if invoked from constructor. Otherwise return
                                            self to allow method chaining.]
                 */
                "children": function(source) {
                    // define vars
                    var elements = [],
                        this_ = this,
                        l = (source) ? source.length : this_.length,
                        array = (source) ? source : this_.stack[this_.stack.length - 1];
                    // loop through the elements getting all their children.
                    for (var i = 0; i < l; i++) {
                        elements = elements.concat(to_array(array[i].children));
                    }
                    // only returns for constructor
                    if (source) return elements;
                    // add elements to the object
                    this_.stack.push(elements);
                    this_.length = elements.length;
                    return this_;
                },
                /**
                 * @description [Get all the siblings of elements in stack.]
                 * @param  {Array}  source [A source point element contained in an array. **Source parameter
                 *                          is only present when running the constructor. Chaining methods
                 *                          does not provide the source parameter. Thus allowing the method to
                 *                          be chainable.]
                 * @return {Array|Object}  [Return elements array if invoked from constructor. Otherwise return
                                            self to allow method chaining.]
                 */
                "siblings": function(source) {
                    // define vars
                    var elements = [],
                        this_ = this,
                        l = (source) ? source.length : this_.length,
                        array = (source) ? source : this_.stack[this_.stack.length - 1];
                    // loop through the elements getting the current elements siblings.
                    // the current element is skipped and not pushed into the set of screened elements.
                    for (var first_element, current_element, i = 0; i < l; i++) {
                        current_element = array[i];
                        first_element = current_element.parentNode.firstChild;
                        while (first_element) {
                            first_element = first_element.nextElementSibling;
                            if (first_element !== current_element && first_element) elements.push(first_element);
                        }
                    }
                    // only returns for constructor
                    if (source) return elements;
                    // add elements to the object
                    this_.stack.push(elements);
                    this_.length = elements.length;
                    return this_;
                },
                /**
                 * @description [Gets the element to the right, or next, of elements in stack.]
                 * @param  {Array}  source [A source point element contained in an array. **Source parameter
                 *                          is only present when running the constructor. Chaining methods
                 *                          does not provide the source parameter. Thus allowing the method to
                 *                          be chainable.]
                 * @return {Array|Object}  [Return elements array if invoked from constructor. Otherwise return
                                            self to allow method chaining.]
                 */
                "next": function(source) {
                    // define vars
                    var elements = [],
                        this_ = this,
                        l = (source) ? source.length : this_.length,
                        array = (source) ? source : this_.stack[this_.stack.length - 1];
                    // loop through the elements getting all the current element's right adjacent element.
                    for (var i = 0; i < l; i++) {
                        elements.push(array[i].nextElementSibling);
                    }
                    // only returns for constructor
                    if (source) return elements;
                    // add elements to the object
                    this_.stack.push(elements);
                    this_.length = elements.length;
                    return this_;
                },
                /**
                 * @description [Gets the element to the left, or previous, of elements in stack.]
                 * @param  {Array}  source [A source point element contained in an array. **Source parameter
                 *                          is only present when running the constructor. Chaining methods
                 *                          does not provide the source parameter. Thus allowing the method to
                 *                          be chainable.]
                 * @return {Array|Object}  [Return elements array if invoked from constructor. Otherwise return
                                            self to allow method chaining.]
                 */
                "prev": function(source) {
                    // define vars
                    var elements = [],
                        this_ = this,
                        l = (source) ? source.length : this_.length,
                        array = (source) ? source : this_.stack[this_.stack.length - 1];
                    // loop through the elements getting all the current element's right adjacent element.
                    for (var i = 0; i < l; i++) {
                        elements.push(array[i].previousElementSibling);
                    }
                    // only returns for constructor
                    if (source) return elements;
                    // add elements to the object
                    this_.stack.push(elements);
                    this_.length = elements.length;
                    return this_;
                },
                /**
                 * @description [Screens collection of elements against provided tags.]
                 * @param  {Strings}  source [N amount of tag names in the form of strings.]
                 * @return {Object}  [Return self to allow method chaining.]
                 */
                "tags": function() {
                    // define vars
                    var elements = helper_one(this, "tags", arguments),
                        this_ = this;
                    // add elements to the object
                    this_.stack.push(elements);
                    this_.length = elements.length;
                    return this_;
                },
                /**
                 * @description [Screens collection of elements against provided classes.]
                 * @param  {Strings}  source [N amount of classes in the form of strings.]
                 * @return {Object}  [Return self to allow method chaining.]
                 */
                "classes": function() {
                    // define vars
                    var elements = helper_one(this, "classes", arguments),
                        this_ = this;
                    // add elements to the object
                    this_.stack.push(elements);
                    this_.length = elements.length;
                    return this_;
                },
                /**
                 * @description [Screens collection of elements against provided text(s).]
                 * @param  {Strings}  source [N amount of text (substrings).]
                 * @return {Object}  [Return self to allow method chaining.]
                 */
                "text": function() {
                    // define vars
                    var elements = helper_one(this, "text", arguments),
                        this_ = this;
                    // add elements to the object
                    this_.stack.push(elements);
                    this_.length = elements.length;
                    return this_;
                },
                /**
                 * @description [Screens collection of elements against provided attrs.]
                 * @return {Object}  [Return self to allow method chaining.]
                 */
                "attrs": function() {
                    // define vars
                    var elements = [],
                        this_ = this;
                    // attribute filters
                    var filters = {
                            /**
                             * @description [Checks that the element does not have the provided attribute.]
                             * @param  {String} pav     [Provided attr value to check against.]
                             * @param  {String} value   [Currently set attribute value.]
                             * @param  {Object} element [The element to check against.]
                             * @return {Bool}
                             */
                            "!": function(pav, value, element) {
                                return !(element.hasAttribute(pav));
                            },
                            /**
                             * @description [Checks if the element has the provided attribute.]
                             * @param  {String} pav     [Provided attr value to check against.]
                             * @param  {String} value   [Currently set attribute value.]
                             * @param  {Object} element [The element to check against.]
                             * @return {Bool}
                             */
                            " ": function(pav, value, element) {
                                return element.hasAttribute(pav);
                            },
                            /**
                             * @description [Checks if pav and the current set value match.]
                             * @param  {String} pav     [Provided attr value to check against.]
                             * @param  {String} value   [Currently set attribute value.]
                             * @param  {Object} element [The element to check against.]
                             * @return {Bool}
                             */
                            "=": function(pav, value) {
                                return pav === value;
                            },
                            /**
                             * @description [Checks to see if the pav and current set value do not match.]
                             * @param  {String} pav     [Provided attr value to check against.]
                             * @param  {String} value   [Currently set attribute value.]
                             * @return {Bool}
                             */
                            "!=": function(pav, value) {
                                return pav !== value;
                            },
                            /**
                             * @description [Checks whether the attr value ends with the provided string.]
                             * @param  {String} pav     [Provided attr value to check against.]
                             * @param  {String} value   [Currently set attribute value.]
                             * @return {Bool}
                             */
                            "$=": function(pav, value) {
                                return value.length - value.lastIndexOf(pav) === pav.length;
                            },
                            /**
                             * @description [Checks whether the attr value equals the provided value or starts with the provided string and a hyphen.]
                             * @param  {String} pav     [Provided attr value to check against.]
                             * @param  {String} value   [Currently set attribute value.]
                             * @return {Bool}
                             */
                            "|=": function(pav, value) {
                                /* ! is used to check if the value is at the zero index */
                                return !includes(value, pav) || !includes(value, pav + "-");
                            },
                            /**
                             * @description [Checks to see if the attr value starts with the provided string.]
                             * @param  {String} pav     [Provided attr value to check against.]
                             * @param  {String} value   [Currently set attribute value.]
                             * @return {Bool}
                             */
                            "^=": function(pav, value) {
                                /* ! is used to check if the value is at the zero index */
                                return !index(value, pav);
                            },
                            /**
                             * @description [Checks to see if the attr value contains the specific value provided; allowing for edge white spaces.]
                             * @param  {String} pav     [Provided attr value to check against.]
                             * @param  {String} value   [Currently set attribute value.]
                             * @return {Bool}
                             */
                            "~=": function(pav, value) {
                                return value.trim() === pav;
                            },
                            /**
                             * @description [Checks if the attr contains the value provided.]
                             * @param  {String} pav     [Provided attr value to check against.]
                             * @param  {String} value   [Currently set attribute value.]
                             * @return {Bool}
                             */
                            "*=": function(pav, value) {
                                return includes(value, pav);
                            }
                        },
                        /**
                         * @description [Filters element stack based on the attrs provided.]
                         * @param {Array} elements [The array of attributes provided.]
                         * @param {Array} attrs    [Array of screened elements.]
                         */
                        set = function(elements, attrs) {
                            // define vars
                            var screened = [];
                            loop1: for (var current_element, i = 0, l = elements.length; i < l; i++) {
                                current_element = elements[i];
                                for (var current_attr, j = 0, ll = attrs.length; j < ll; j++) {
                                    current_attr = attrs[j]; // i.e. -> ["type", "=", "file"] or [true, " " , type] or [false, "!", "value"]
                                    if (!filters[current_attr[1]](current_attr[2], current_element.getAttribute(current_attr[0]), current_element)) continue loop1;
                                    if (j === ll - 1) screened.push(current_element);
                                }
                            }
                            return screened;
                        },
                        /**
                         * @description [Parses paorived attrs.]
                         * @param  {Array} attrs [The array of attributes provided, both has and nothas.]
                         * @return {Array}       [An array containing the cleaned attributes.]
                         */
                        input = function(attrs) {
                            // define vars
                            var types = Object.keys(filters),
                                ll = types.length,
                                screened = [];
                            loop1: for (var current_attr, i = 0, l = attrs.length; i < l; i++) {
                                current_attr = attrs[i].replace(/^\[|\]$/g, ""); // [type=file] -> type=file
                                for (var j = ll - 1; j > -1; j--) {
                                    var type = types[j];
                                    var check = includes(current_attr, type);
                                    if (check) { // type found
                                        var parts = current_attr.split(type);
                                        screened.push([parts[0], type, parts[1]]);
                                        continue loop1; // continue w/ next attribute check
                                    } else if (!check && j === 1) { // when no value is supplied
                                        // case [!type] -> checks that element does not have type attribute
                                        if (current_attr.charCodeAt(0) === 33) screened.push([false, "!", current_attr.substring(1)]);
                                        // else just checking if attribute is present -> [type]
                                        else screened.push([true, " ", current_attr]);
                                        continue loop1; // continue w/ next attribute check
                                    }
                                }
                            }
                            return screened;
                        };
                    elements = set(this_.stack[this_.stack.length - 1], input(arguments));
                    // add elements to the object
                    this_.stack.push(elements);
                    this_.length = elements.length;
                    return this_;
                },
                /**
                 * @description [Shorthand for attribute methods, e.g. Library.form(":text").]
                 * @return {Object}  [Return self to allow method chaining.]
                 */
                "form": function() {
                    // define vars
                    var this_ = this;
                    // clean the provided arguments and pass it to the attr() function.
                    // modify the arguments object...
                    for (var args = arguments, i = 0, l = args.length; i < l; i++) {
                        args[i] = "[type=" + args[i].replace(/^\:/, "") + "]";
                    }
                    // invoke the attr() method.
                    this_.attrs.apply(this_, args);
                    // no need to update just return self as the updating is done above when
                    // attrs() method is invoked.
                    return this_;
                },
                /**
                 * @description [Screens stack based on their property state, disabled,
                 *               selected, and checked.]
                 * @param  {String} property [The property to check against.]
                 * @param  {Bool} state    [Provided boolean to check property against.]
                 * @return {Object}  [Return self to allow method chaining.]
                 */
                "state": function(property, state) {
                    // define vars
                    var elements = [],
                        this_ = this,
                        array = this_.stack[this_.stack.length - 1];
                    // the states contains the 3 possible methods in whick to
                    // filter by; empty, visible, and default property check (checked,
                    // selected, etc.).
                    var states = {
                        // this takes into account both child elements and text nodes
                        "empty": function(element, bool) {
                            return !element.childNodes.length === bool;
                        },
                        "visible": function(element, bool) {
                            return (((element.offsetHeight >= 1) ? 1 : 0) == bool);
                        }
                    };
                    // If the property provided is not empty or visible we set filter function
                    // to the other property provided. e.g. "checked".
                    // [http://stackoverflow.com/questions/7851868/whats-the-proper-value-for-a-checked-attribute-of-an-html-checkbox]
                    var filter = states[property] || function(element, bool, property) {
                        return element[property] == bool;
                    };
                    // loop through elements and screen to see if they have the property set to the provided state of either true or false.
                    for (var current_element, i = 0, l = array.length; i < l; i++) {
                        current_element = array[i];
                        if (filter(current_element, state, property)) elements.push(current_element);
                    }
                    // add elements to the object
                    this_.stack.push(elements);
                    this_.length = elements.length;
                    return this_;
                },
                /**
                 * @description [Positional filter which skips elements at provided indices.]
                 * @param  {Array}  indices_to_skip [Indices to be skipped.]
                 * @return {Object}  [Return self to allow method chaining.]
                 */
                "skip": function(indices_to_skip) {
                    // define vars
                    var elements = [],
                        this_ = this,
                        array = this_.stack[this_.stack.length - 1],
                        // if -1 is a provided index we shorten the length by 1. This means
                        // the user wants to skip the last item.
                        l = (includes(indices_to_skip, -1)) ? (array.length - 1) : array.length;
                    // loop through and only adding to the screened array indices not found in the
                    // indices_to_skip array.
                    for (var i = 0; i < l; i++) {
                        if (!includes(indices_to_skip, i)) elements.push(array[i]);
                    }
                    // add elements to the object
                    this_.stack.push(elements);
                    this_.length = elements.length;
                    return this_;
                },
                /**
                 * @description [Positional filter which only gets elements at provided indices.]
                 * @param  {Array}  wanted_indices [Indices where elements are wanted.]
                 * @return {Object}  [Return self to allow method chaining.]
                 */
                "only": function(wanted_indices) {
                    // define vars
                    var elements = [],
                        this_ = this,
                        array = this_.stack[this_.stack.length - 1];
                    // loop through and only add elements that match indices found in the provided
                    // wanted_indices array. **Note: if the current wanted index is negative we simply
                    // count backwards. e.g. array[l + current_windex].
                    for (var current_windex, l = array.length, i = 0, ll = wanted_indices.length; i < ll; i++) {
                        current_windex = wanted_indices[i];
                        if (current_windex < l) elements.push((current_windex < 0) ? array[l + current_windex] : array[current_windex]);
                    }
                    // add elements to the object
                    this_.stack.push(elements);
                    this_.length = elements.length;
                    return this_;
                },
                /**
                 * @description [Positional filter which screens elements based on a provided range.]
                 * @param  {Array}  range [The provided range to work with in the form [start, stop, step].]
                 * @return {Object}  [Return self to allow method chaining.]
                 * @example :even range => [0, -1, 2]
                 * @example :odd range => [1, -1, 2]
                 * @example :entire range => [0, -1, 1]
                 * @example :< 3 range => [0, 3, 1]
                 * @example :> 4 range => [4, -1, 1]
                 */
                "range": function(range) {
                    // define vars
                    var elements = [],
                        this_ = this,
                        array = this_.stack[this_.stack.length - 1],
                        l = array.length;
                    // cache range parts
                    var start = range[0],
                        stop = range[1] + 1,
                        step = (range[2] || 1);
                    // if the stop is set to -1 or the range provided is larger than the length of the
                    // elements array we need to reset the stop from -1 to the length of the elements array.
                    // [1] The user wants to cycle through all the elements.
                    // [2] Range exceeds length of the elements array.
                    // (tilde-explanation)[http://stackoverflow.com/questions/12299665/what-does-a-tilde-do-when-it-
                    // precedes-an-expression/12299717#12299717]
                    if ( /*[1]*/ !~range[1] || /*[2]*/ stop > l) stop = l;
                    // if provided start is larger than the elements array we reset it to 0.
                    if (start > l) start = 0;
                    // Loop through using the provided start, stop, and step values.
                    for (var i = start; i < stop;) {
                        elements.push(array[i]);
                        i = i + step;
                    }
                    // add elements to the object
                    this_.stack.push(elements);
                    this_.length = elements.length;
                    return this_;
                },
                /**
                 * @description [Returns last element collection stack. If an index is provided
                 *               the element stack at that index is provided.]
                 * @param  {Number} index [The element stack index to return.]
                 * @return {Array} [Last element collection.]
                 */
                "getStack": function(index) {
                    // define vars
                    var this_ = this,
                        stacks = this_.stack;
                    // reverse the stacks. the stack needs to be reversed because every
                    // time a new stack is added to the stack it gets appended to the
                    // stack. therefore, the the latest stack is the last one, but to
                    // make it easier to get the wanted stack the stacks are reversed
                    // to make the latest stack be at the 0th index.
                    stacks.reverse();
                    // default the index if not provided
                    if (typeof index !== "number") index = 0;
                    // reset the index if provided index is negative
                    if (index < 0) index = (stacks.length + index);
                    // get the wanted element stack
                    var stack = stacks[index] || [];
                    // unreverse array stack to revert it to its normal state
                    stacks.reverse();
                    // return the appropriate stack
                    return stack;
                },
                /**
                 * @description [Returns the first element of the last collection stack. If an
                 *               index is provided that element at that index is returned.]
                 * @param  {Number} index [The element stack index to return.]
                 * @return {HTMLElement} [The needed element.]
                 */
                "getElement": function(index) {
                    // define vars
                    var this_ = this,
                        stack = this_.getStack.call(this_, index);
                    // default the index if not provided
                    if (typeof index !== "number") index = 0;
                    // reset the index if provided index is negative
                    if (index < 0) index = (stack.length + index);
                    // get the wanted element
                    var element = (stack[index] || null);
                    // return the first element of the last stack,
                    // or the element at the index provided
                    return element;
                },
                /**
                 * @status [No longer supported but kept for any possible future breakage.]
                 * @description [Returns last element collection stack.]
                 * @return {Array} [Last element collection.]
                 */
                // "pop": function() {
                //     var this_ = this;
                //     return this_.stack[this_.stack.length - 1];
                // },
                /**
                 * @description [Combines (concats) provided array of elements with the current
                 *               stack of elements.]
                 * @param  {Array} new_elements [The array of elements to concats initial array with.]
                 * @return {Object}  [Return self to allow method chaining.]
                 */
                "concat": function(new_elements) {
                    // define vars
                    var this_ = this,
                        // the last stack
                        array = this_.stack[this_.stack.length - 1],
                        elements;
                    // combine the last stack with the provided elements array
                    elements = array.concat(new_elements || []);
                    // add elements to the object
                    this_.stack.push(elements);
                    this_.length = elements.length;
                    return this_;
                },
                /**
                 * @description [Checks whether the last stack of is not empty.]
                 * @param  {Array} new_elements [The array of elements to concats initial array with.]
                 * @return {Boolean}  [True for non empty stack. Otherwise, false.]
                 */
                "iterable": function() {
                    // check for elements in the last stack
                    // define vars
                    var this_ = this,
                        // the last stack
                        array = this_.stack[this_.stack.length - 1];
                    // check if the last stack is not empty
                    return (array.length ? true : false);
                },
                /** @description [Empty method; added to mask object as an array.] */
                "splice": function() { /* noop */ },
            },
            // class to extend
            "extend__": false
        });
        // return library to add to global scope later...
        return Library;
    })();
    // =============================== Global Library Functions/Methods/Vars
    // =============================== Attach Library To Global Scope
    // add to global scope for ease of use
    // use global app var or create it if not present
    var app = window.app || (window.app = {});
    // get the libs object from within the app object
    // if it does not exist create it
    var libs = app.libs || (app.libs = {});
    // add the library to the libs object
    libs.Funnel = library;
    // IIFE end
})(window);
// IIFE start
(function(window) {
    "use strict";
    var library = (function() {
        // =============================== Helper Functions
        /**
         * @description [Generates a simple ID containing letters and numbers.]
         * @param  {Number} length [The length the ID should be. Max length is 22 characters]
         * @return {String}        [The newly generated ID.]
         * @source {http://stackoverflow.com/a/38622545}
         */
        function id(length) {
            return Math.random()
                .toString(36)
                .substr(2, length);
        }
        /**
         * @description [Returns index of given value in provided array.]
         * @param  {Array}    array [The array to check against.]
         * @param  {Integer}  value [The value to check.]
         * @return {Integer}        [Returns the index value. -1 if not in array.]
         */
        function index(array, value) {
            return array.indexOf(value);
        }
        /**
         * @description [Checks if the given value is in provided array or string.]
         * @param  {Array|String}   iterable [The array or string to check against.]
         * @param  {Any}            value    [The value to check.]
         * @return {Boolean}                 [description]
         * @source [https://www.joezimjs.com/javascript/great-mystery-of-the-tilde/]
         * @source [http://stackoverflow.com/questions/12299665/what-does-a-tilde-do-
         * when-it-precedes-an-expression/12299717#12299717]
         */
        function includes(iterable, value) {
            return -~index(iterable, value);
        }
        /**
         * @description [Checks if the provided index exists.]
         * @param  {Number} index [The index (number) to check.]
         * @return {Boolean}       [False if -1. Otherwise, true.]
         */
        function indexed(index) {
            return -~index ? true : false;
        }
        /**
         * @description [Makes an Array from an array like object (ALO). ALO must have a length property
         *               for it to work.]
         * @param  {ALO} alo [The ALO.]
         * @return {Array}   [The created array.]
         */
        function to_array(alo) {
            // vars
            var true_array = [];
            // loop through ALO and pushing items into true_array
            for (var i = 0, l = alo.length; i < l; i++) true_array.push(alo[i]);
            return true_array;
        }
        /**
         * @description [Returns the data type of the provided object.]
         * @param  {Any} object [The object to check.]
         * @return {String}    [The data type of the checked object.]
         */
        var dtype = function(object) {
            // will always return something like "[object {type}]"
            return Object.prototype.toString.call(object)
                .replace(/(\[object |\])/g, "")
                .toLowerCase();
        };
        /**
         * @description [Check if the provided object is of the provided data types.]
         * @param  {Any} object [The object to check.]
         * @param  {String}  types  [The allowed data type the object may be.]
         * @return {Boolean}        [Boolean indicating whether the object is of the
         *                           allowed data types.]
         */
        dtype.is = function(object, types) {
            // get the object type
            var type = this(object);
            // prepare the types
            types = "|" + types.toLowerCase()
                .trim() + "|";
            // check if the object's type is in the list
            return Boolean(-~types.indexOf("|" + type + "|"));
        };
        /**
         * @description [Check if the provided object is not of the provided data types.]
         * @param  {Any} object [The object to check.]
         * @param  {String}  types  [The prohibited data types.]
         * @return {Boolean}        [Boolean indicating whether the object is not of the
         *                           allowed data types.]
         */
        dtype.isnot = function(object, types) {
            // return the inverse of the is method
            return !this.is(object, types);
        };
        /**
         * @description [A class wrapper. Creates a class based on provided object containing class constructor__ and methods__.
         *               If class needs to extend another, provide it under the extend__ property.]
         * @param  {Object} cobject [The class object containing three properties: constructor__, methods__, and extend__.
         *                           .constructor__ {Function}       [The class constructor]
         *                           .methods__     {Object}         [Object containing class methods.]
         *                           .extend__      {Boolean|Object} [Set to false if does not need to extend. Otherwise, provide the
         *                                                            class to extend.]
         *                           ]
         * @return {Function}         [Returns class constructor.]
         */
        function class__(cobject) {
            // cache class data
            var constructor = cobject.constructor__,
                methods = cobject.methods__,
                parent = cobject.extend__;
            // extend if parent class provided
            if (parent) {
                constructor.prototype = Object.create(parent.prototype);
                constructor.prototype.constructor = constructor;
            }
            // cache prototype
            var prototype = constructor.prototype;
            // add class methods to prototype
            for (var method in methods) {
                if (methods.hasOwnProperty(method)) {
                    prototype[method] = methods[method];
                }
            }
            return constructor;
        }
        // =============================== Core Library Functions
        // =============================== Library Class
        var Library = class__({
            // class constructor
            "constructor__": function(controller, object) {
                // if user does not invoke query with new keyword we use it for them by
                // returning a new instance of the selector with the new keyword.
                if (!(this instanceof Library)) return new Library(controller, object);
                // set properties
                this.controller = (controller || undefined);
                this.object = (object || {});
                this.cache = {};
                this.callbacks = {
                    strings: [],
                    regexps: [],
                };
            },
            // class methods
            "methods__": {
                /**
                 * @description [Check whether the object has the provided path.]
                 * @param  {String} path        [The path to check.]
                 * @return {Boolean|Object}     [False if path does not exist. Otherwise, an object containing the value at the
                 *                               at the provided object path.]
                 */
                "get": function(path) {
                    // cache the object
                    var _ = this,
                        object = _.object;
                    // 1) remove start/ending slashes
                    path = path.replace(/^\.|\.$/g, "");
                    // 2) break apart the path
                    var parts = path.split(".");
                    // 4) parse each path
                    for (var i = 0, l = parts.length; i < l; i++) {
                        // cache the part
                        var part = parts[i];
                        // get the prop name and possible array indices
                        var prop = (part.match(/^[^\[]+/g) || [""])[0],
                            indices = (part.match(/\[\d+\]/g) || []);
                        // reset the part
                        parts[i] = [part, prop, indices];
                    }
                    // 5) check the path existence
                    var old = object,
                        obj = object;
                    for (var i = 0, l = parts.length; i < l; i++) {
                        // cache the part
                        var part = parts[i];
                        // get the prop name and possible array indices
                        var prop = part[1],
                            indices = part[2];
                        if (!obj[prop] && !obj.hasOwnProperty(prop)) {
                            return false;
                        } else {
                            // reset the ref, as the object was found
                            old = obj;
                            obj = obj[prop];
                        }
                        // check for indices
                        if (indices.length) {
                            for (var j = 0, ll = indices.length; j < ll; j++) {
                                var index = indices[j].replace(/^\[|\]$/g, "");
                                // get the new object
                                old = obj;
                                obj = obj[index];
                                if (dtype.isnot(obj, "Object|Array")) {
                                    return false;
                                }
                            }
                        }
                    }
                    // return the object with the updated/new path
                    return {
                        val: obj
                    };
                },
                /**
                 * @description [Sets the provided value at the provided path.]
                 * @param  {String} path        [The path to set.]
                 * @param  {Any} value        [The value to set.]
                 * @return {Object}     [The Monitor object.]
                 */
                "set": function(path, value) {
                    // cache the object
                    var _ = this,
                        object = _.object,
                        cache = _.cache,
                        date = Date.now(),
                        entry, type = "update";
                    // 1) first check cache for path
                    entry = cache[path.trim()];
                    // if no cache entry run the get method
                    // i.e. this path might have been added before
                    // the library started to monitor the object
                    if (!entry) {
                        // the path check
                        var result = _.get(path);
                        // the result must be of type object
                        var check = (dtype.is(result, "Object"));
                        // get the value of the get check, else default to undefined
                        // checks are done separately as the value undefined is an
                        // actual value that the path by result in
                        var val = (check ? result.val : undefined);
                        // create the "fake" entry, only needs the value
                        entry = [, , val];
                        // determine the type
                        type = (check ? "update" : "add");
                    }
                    // determine the old value
                    var old_value = (entry ? entry[2] : undefined);
                    // update the cache
                    cache[path] = [date, type, value];
                    // ------------------------------------
                    // 1) remove start/ending slashes
                    path = path.replace(/^\.|\.$/g, "");
                    // 2) break apart the path
                    var parts = path.split(".");
                    // 4) parse each path
                    for (var i = 0, l = parts.length; i < l; i++) {
                        // cache the part
                        var part = parts[i];
                        // get the prop name and possible array indices
                        var prop = (part.match(/^[^\[]+/g) || [""])[0],
                            indices = (part.match(/\[\d+\]/g) || []);
                        // reset the part
                        parts[i] = [part, prop, indices];
                    }
                    // 5) build the path
                    var old = object,
                        obj = object;
                    for (var i = 0, l = parts.length; i < l; i++) {
                        // cache the part
                        var part = parts[i];
                        // get the prop name and possible array indices
                        var prop = part[1],
                            indices = part[2];
                        // set the value if the last prop
                        if (i === (l - 1) && !indices.length) {
                            // get the last obj ref
                            obj[prop] = value;
                        } else {
                            // check if the object exists (set the object path)
                            // check if the property exists else add a new object
                            var crumb = (obj[prop] ? obj[prop] : (indices.length ? [] : {}));
                            obj[prop] = crumb;
                            // reset the obj refs
                            old = obj;
                            obj = obj[prop];
                        }
                        // ------------------------------------
                        // check for indices
                        if (indices.length) {
                            for (var j = 0, ll = indices.length; j < ll; j++) {
                                var index = indices[j].replace(/^\[|\]$/g, "");
                                if (j === (ll - 1)) { // only run on the last index iteration
                                    if (i === (l - 1)) { // if the last-last set the final value
                                        obj[index] = value;
                                    } else { //
                                        // more props to loop over
                                        // check if the property exists else add a new object
                                        var crumb = (obj[index] ? obj[index] : {});
                                        obj[index] = crumb;
                                        // reset the obj refs
                                        old = obj;
                                        obj = obj[index];
                                    }
                                } else {
                                    // set the object path
                                    // check if the property exists else add a new object
                                    var crumb = (obj[index] ? obj[index] : []);
                                    obj[index] = crumb;
                                    // reset the obj refs
                                    old = obj;
                                    obj = obj[index];
                                }
                            }
                        }
                    }
                    // ------------------------------------
                    // the callback args
                    var args = [path, type, value, old_value, date];
                    // run the callback (controller) if provided
                    if (_.controller) _.controller.apply(_, args);
                    // run any callbacks that match the path (either string or regexp)
                    var callbacks = this.callbacks;
                    // loop over strings array
                    var strings = callbacks.strings;
                    for (var i = 0, l = strings.length; i < l; i++) {
                        // cache the needed info
                        var callback = strings[i],
                            cb_path = callback[0],
                            cb_cb = callback[1];
                        // check if the paths match
                        if (cb_path === path) {
                            // console.log("strings::SET", path, cb_path);
                            // run the callback
                            cb_cb.apply(_, args);
                        }
                    }
                    // loop over regexps array
                    var regexps = callbacks.regexps;
                    for (var i = 0, l = regexps.length; i < l; i++) {
                        // cache the needed info
                        var callback = regexps[i],
                            cb_path = callback[0],
                            cb_cb = callback[1];
                        // reusing regexp needs resetting of the lastIndex prop [https://siderite.blogspot.com/2011/11/careful-when-reusing-javascript-regexp.html#at3060321440]
                        cb_path.lastIndex = 0;
                        // check if the paths match
                        if (cb_path.test(path)) {
                            // console.log("regexps::SET", path, cb_path);
                            // run the callback
                            cb_cb.apply(_, args);
                        }
                    }
                    // return the object with the updated/new path
                    return object;
                },
                /**
                 * @description [Unsets the last object of the provided path.]
                 * @param  {String} path         [The path to unset from.]
                 * @return {Undefined}           [Nothing is returned.]
                 */
                "unset": function(path) {
                    // cache the object
                    var _ = this,
                        object = _.object,
                        cache = _.cache,
                        date = Date.now();
                    // 1) remove start/ending slashes
                    path = path.replace(/^\.|\.$/g, "");
                    // 2) break apart the path
                    var parts = path.split(".");
                    // 4) parse each path
                    for (var i = 0, l = parts.length; i < l; i++) {
                        // cache the part
                        var part = parts[i];
                        // get the prop name and possible array indices
                        var prop = (part.match(/^[^\[]+/g) || [""])[0],
                            indices = (part.match(/\[\d+\]/g) || []);
                        // reset the part
                        parts[i] = [part, prop, indices];
                    }
                    // 5) check the path existence
                    var old = object,
                        obj = object;
                    for (var i = 0, l = parts.length; i < l; i++) {
                        // cache the part
                        var part = parts[i];
                        // get the prop name and possible array indices
                        var prop = part[1],
                            indices = part[2];
                        if (!obj[prop] && !obj.hasOwnProperty(prop)) {
                            return false;
                        } else {
                            // reset the ref, as the object was found
                            old = obj;
                            obj = obj[prop];
                        }
                        // check for indices
                        if (indices.length) {
                            for (var j = 0, ll = indices.length; j < ll; j++) {
                                var index = indices[j].replace(/^\[|\]$/g, "");
                                // get the new object
                                old = obj;
                                obj = obj[index];
                                if (dtype.isnot(obj, "Object|Array")) {
                                    return false;
                                }
                            }
                        }
                    }
                    // ------------------------------------
                    // remove the last property from the path
                    delete old[prop];
                    // the callback args
                    var args = [path, "delete", undefined, obj, date];
                    // run the callback (controller) if provided
                    if (_.controller) _.controller.apply(_, args);
                    // run any callbacks that match the path (either string or regexp)
                    var callbacks = this.callbacks;
                    // loop over strings array
                    var strings = callbacks.strings;
                    for (var i = 0, l = strings.length; i < l; i++) {
                        // cache the needed info
                        var callback = strings[i],
                            cb_path = callback[0],
                            cb_cb = callback[1];
                        // check if the paths match
                        if (cb_path === path) {
                            // console.log("strings::UNSET", path, cb_path);
                            // run the callback
                            cb_cb.apply(_, args);
                        }
                    }
                    // loop over regexps array
                    var regexps = callbacks.regexps;
                    for (var i = 0, l = regexps.length; i < l; i++) {
                        // cache the needed info
                        var callback = regexps[i],
                            cb_path = callback[0],
                            cb_cb = callback[1];
                        // reusing regexp needs resetting of the lastIndex prop [https://siderite.blogspot.com/2011/11/careful-when-reusing-javascript-regexp.html#at3060321440]
                        cb_path.lastIndex = 0;
                        // check if the paths match
                        if (cb_path.test(path)) {
                            // console.log("regexps::UNSET", path, cb_path);
                            // run the callback
                            cb_cb.apply(_, args);
                        }
                    }
                },
                /**
                 * @description [Triggers the controller. Using the provided path and value.]
                 * @param  {String} path         [The path to check.]
                 * @param  {Any} value           [The value to use.]
                 * @return {Undefined}           [Nothing is returned.]
                 */
                "trigger": function(path, value) {
                    // cache the object
                    var _ = this,
                        object = _.object,
                        cache = _.cache,
                        date = Date.now(),
                        entry, type = "trigger";
                    // 1) first check cache for path
                    entry = cache[path.trim()];
                    // if no cache entry run the get method
                    // i.e. this path might have been added before
                    // the library started to monitor the object
                    if (!entry) {
                        // the path check
                        var result = _.get(path);
                        // the result must be of type object
                        var check = (dtype.is(result, "Object"));
                        // get the value of the get check, else default to undefined
                        // checks are done separately as the value undefined is an
                        // actual value that the path by result in
                        var val = (check ? result.val : undefined);
                        // create the "fake" entry, only needs the value
                        entry = [, , val];
                    }
                    // determine the old value
                    var old_value = (entry ? entry[2] : undefined);
                    // update the cache
                    cache[path] = [date, type, value];
                    // ------------------------------------
                    // the callback args
                    var args = [path, type, (value || undefined), old_value, date];
                    // run the callback (controller) if provided
                    if (_.controller) _.controller.apply(_, args);
                    // run any callbacks that match the path (either string or regexp)
                    var callbacks = this.callbacks;
                    // loop over strings array
                    var strings = callbacks.strings;
                    for (var i = 0, l = strings.length; i < l; i++) {
                        // cache the needed info
                        var callback = strings[i],
                            cb_path = callback[0],
                            cb_cb = callback[1];
                        // check if the paths match
                        if (cb_path === path) {
                            // console.log("strings::TRIGGER", path, cb_path);
                            // run the callback
                            cb_cb.apply(_, args);
                        }
                    }
                    // loop over regexps array
                    var regexps = callbacks.regexps;
                    for (var i = 0, l = regexps.length; i < l; i++) {
                        // cache the needed info
                        var callback = regexps[i],
                            cb_path = callback[0],
                            cb_cb = callback[1];
                        // reusing regexp needs resetting of the lastIndex prop [https://siderite.blogspot.com/2011/11/careful-when-reusing-javascript-regexp.html#at3060321440]
                        cb_path.lastIndex = 0;
                        // check if the paths match
                        if (cb_path.test(path)) {
                            // console.log("regexps::TRIGGER", path, cb_path);
                            // run the callback
                            cb_cb.apply(_, args);
                        }
                    }
                },
                "on": function(path, callback) {
                    // add the callback to the callback registry
                    // existing callbacks with the same path will overwrite existing callback
                    // add to the appropriate array
                    this.callbacks[(dtype(path) === "string" ? "strings" : "regexps")].push([path, callback]);
                },
                "off": function(path) {
                    // run any callbacks that match the path (either string or regexp)
                    var callbacks = this.callbacks;
                    // loop over strings array
                    var strings = callbacks.strings;
                    for (var i = 0, l = strings.length; i < l; i++) {
                        // cache the needed info
                        var callback = strings[i],
                            cb_path = callback[0],
                            cb_cb = callback[1];
                        // check if the paths match
                        if (cb_path === path) {
                            // console.log("strings::OFF", path, cb_path);
                            // remove the listener from the array
                            strings.splice(i, 1);
                        }
                    }
                    // loop over regexps array
                    var regexps = callbacks.regexps;
                    for (var i = 0, l = regexps.length; i < l; i++) {
                        // cache the needed info
                        var callback = regexps[i],
                            cb_path = callback[0],
                            cb_cb = callback[1];
                        // check if the paths match
                        if (cb_path.toString() === path.toString()) {
                            // console.log("regexps::OFF", path, cb_path);
                            // remove the listener from the array
                            regexps.splice(i, 1);
                        }
                    }
                },
                // "disable": function() {}
            },
            // class to extend
            "extend__": false
        });
        // return library to add to global scope later...
        return Library;
    })();
    // =============================== Global Library Functions/Methods/Vars
    // =============================== Attach Library To Global Scope
    // add to global scope for ease of use
    // use global app var or create it if not present
    var app = window.app || (window.app = {});
    // get the libs object from within the app object
    // if it does not exist create it
    var libs = app.libs || (app.libs = {});
    // add the library to the libs object
    libs.Monitor = library;
    // IIFE end
})(window);