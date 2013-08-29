/*
 * Q – homebrew js library with rough edges.
 *
 * I wrote Q while developing some prototypes that take advantage of recent feature implementations in Gecko/Firefox
 * and thus I didn't care about cross-browser-compatibilty at all. It's a work in progress. Q alters several native
 * prototypes, so naming collisions are possible when used with other libs or your own code.
 *
 * Principles Q follows:
 * ---------------------
 *   + leverage native DOM functionality where possible
 *   + distribute logic equally
 *   + do optimistic argument handling (no bullet-proof arg checks)
 *   + keep the API consistent and meaningful – no hippie conventions
 *
 *
 * @package core
 * @author Peter Geil
 * @license MIT
 */
var q = {

	namespace: function(ns, members) {
		if (typeof ns !== 'string') throw new Error('Namespace must be type of string');

		ns = ns.split('.');

		for (var i=0, j=ns.length, ptr=window; i < j; i++)
			ptr = (ptr[ns[i]] = ptr[ns[i]] || {});

		if (ns.length && undefined !== members)
			q.extend(ptr, members);

		return ptr; }

	, identify: (function() {
		var guid = 0;
		return function identify(obj) {
			if ( ! obj.hasOwnProperty('_guid'))
				Object.defineProperty(obj, '_guid', { value: guid++ });

			return obj.getProperty('_guid');
		}
	})()

	, extend: function(base, ext, withEnums) {
		var props = Object[(true === withEnums) ? 'getOwnPropertyNames' : 'keys'](ext);

		if (base.constructor === Array) {
			// Batch mode
			var nBases = base.length, i, j;
			while (nBases-- > 0)
				for (i=0, j=props.length; i < j; i++)
					base[nBases][props[i]] = ext[props[i]];
		} else {
			// Default
			for (var i=0, j=props.length; i < j; i++)
				base[props[i]] = ext[props[i]];
		}

		return base; }

	, merge: function(base, ext) {
		var props = Object.keys(ext);

		for (var i=0, j=props.length, k; i < j; i++) {
			k = props[i];
			if ( ! base.hasOwnProperty(k)) base[k] = ext[k];
		}

		return base; }

	/**
	 * Takes constructor function and/or an object and appends all own enumerable properties to the constructor's
	 * prototype object.
	 *
	 * @param {Function|Object} ctor Constructor function (or prototype object)
	 * @param {Object} proto Object whose properties are appended to the constructor prototype (optional)
	 * @return Function
	 *
	 */
	, proto: function(ctor, proto) {
		if (1 === arguments.length && typeof ctor.constructor === 'function') {
			// use constructor function contained in prototype object
			proto = ctor;
			ctor = proto.constructor;
			ctor.prototype = proto;
		} else if (2 === arguments.length) {
			// extend prototype of constructor with props from given object
			q.extend(ctor.prototype, proto);
		}

		return ctor; }
};

Object.prototype.extend = function(ext, withEnums) {
	return q.extend(this, ext, withEnums);
};