/** @license MIT License (c) copyright 2011-2013 original author or authors */

/**
 * Allows declarative creation of jQuery UI widgets.
 * wire is part of the cujo.js family of libraries (http://cujojs.com/)
 *
 * @author Brian Cavalier
 * @author John Hann
 *
 * Licensed under the MIT License at:
 * http://www.opensource.org/licenses/mit-license.php
 */
define(['when', 'jquery', '../lib/proxy'], function (when, $, wireProxy) {

	var typeDataProp, observeDataProp, proxyMixin, undef;

	typeDataProp = 'wire$type';
	observeDataProp = 'wire$observe';
	
	proxyMixin = getWidgetProxyMixin();

	return {
		wire$plugin: function jQueryUIPlugin (ready, destroy, options) {
			return {
				factories: {
					widget: widgetFactory
				},
				proxies: [
					proxyWidget
				]
			};
		}
	};

	/**
	 * Creates a jQuery UI widget on top of a dom node.
	 * @param {Deferred} resolver
	 * @param {Object} spec
	 * @param {Function} wire
	 */
	function widgetFactory (resolver, spec, wire) {
		var type, widget;

		type = spec.options.type;

		if (!type) throw new Error('widget factory requires a "type" property.');

		// jQuery UI widgets place things at $[type] $.ui[type] and $.fn[type].
		// however, wijmo widgets only appear at $.fn[type].
		if (typeof $.fn[type] != 'function') {
			throw new Error('widget factory could not find a jQuery UI Widget constructor for ' + type);
		}

		widget = when.join(wire(spec.options.node), wire(spec.options.options || {}))
			.spread(createWidget);

		resolver.resolve(widget);

		function createWidget (el, options) {
			var $w;

			if (!isNode(el) && !isjQWrapped(el)) throw new Error('widget factory could not resolve "node" property: ' + spec.options.node);

			$w = $(el);
			$w.data(typeDataProp, type);

			return $w[type](options);
		}

	}
	
	/**
	 * Extends the base wire proxy if the target is a jQuery UI widget.
	 * @param {Object} proxy
	 */
	function proxyWidget (proxy) {
		if (isWidget(proxy.target)) {
			return wireProxy.extend(proxy, proxyMixin);
		}
	}

	/**
	 * Creates an object to use to extend the base wire proxy.
	 * @return {Object}
	 */
	function getWidgetProxyMixin () {
		return {
			get: function (name) {
				var $w, type, data;
				
				$w = this.target;
				type = $w.data(typeDataProp);

				// if there is a method with this name, call it to get value
				if (typeof $w[name] == 'function') return $w[name]();

				// if there is an option (not undefined), then return that
				if (hasOption($w, type, name)) return $w[type]('option', name);

				// check if it's a data item
				data = $w.data();
				if (name in data) {
					return data[name];
				}
				
				// try an auto-getter/setter property
				return createAccessor(this, $w, name);
			},

			set: function (name, value) {
				var $w, type;
				
				$w = this.target;
				type = $w.data(typeDataProp);

				// if there is a function with this name, call it to set value
				if (typeof $w[name] == 'function') return $w[name](value);

				// if there is an option (not undefined), set it
				if (hasOption($w, type, name)) return $w[type]('option', name, value);

				// must be a data item
				return $w.data(name, value);

			},

			invoke: function (method, args) {
				var $w, type, func, margs;
				
				$w = this.target;
				type = $w.data(typeDataProp);
				func = typeof method == 'function'
					? method // wrapped function
					: this.get(method); // wire property
				
				if (typeof func == 'function') {
					return func.apply(null, args);
				}
				else {
					margs = [method];
					if (args && args.length) {
						// using margs's slice to ensure args is an array (instead of Arguments)
						margs = margs.concat(margs.slice.apply(args));
					}

					return $w[type].apply($w, margs);
				}
			},

			destroy: function () {
				var $w = this.target;
				$w.destroy();
			},

			clone: function (options) {
				var $w = this.target;
				// default is to clone deep (when would anybody not want deep?)
				return $w.clone(!('deep' in options) || options.deep);
			},
			
			observe: function (property, callback) {
				var $w, observers, callbacks;
				
				$w = this.target;
				
				// ensure we have an observers set
				observers = $w.data(observeDataProp);
				if (!observers) $w.data(observeDataProp, observers = {});
				
				// ensure we have a callbacks list
				callbacks = observers[property];
				if (!callbacks) callbacks = observers[property] = [];
				
				// ensure callback is in the list
				if (callbacks.indexOf(callback) < 0) callbacks.push(callback);
			}
		};
	}

	function hasOption ($w, type, name) {
		// thankfully, all options should be pre-defined in a jquery ui widget
		var options = $w[type]('option');
		return options && name in options;
	}
	
	function createAccessor (proxy, $w, name) {
		var type, prop;
		
		type = name.substr(0, 3);
		prop = name.charAt(3).toLowerCase() + name.substr(4);
		
		if (type == 'get') {
			return function () {
				return proxy.get(prop);
			};
		}
		else if (type == 'set') {
			return function (value) {
				return proxy.set(prop, value);
			};
		}
	}
	
	function isWidget (it) {
		return it
			&& it.data
			&& !!it.data(typeDataProp);
	}

	function isNode (it) {
		return typeof Node == 'object'
			? it instanceof Node
			: it && typeof it == 'object' && typeof it.nodeType == 'number' && typeof it.nodeName == 'string';
	}

	function isjQWrapped (it) {
		return typeof it == 'function' && typeof it.jquery == 'function';
	}
	
});
