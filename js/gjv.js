/**
 * geoJSON validation according to the GeoJSON spefication Version 1
 * @module geoJSONValidation
 * @class Main
 * @exports {GJV}
 */

(function(exports){

	var definitions = {};

	/**
	 * Test an object to see if it is a function
	 * @method _isFunction
	 * @private
	 * @param object {Object}
	 * @return {Boolean}
	 */
	function _isFunction(object) {
		return typeof(object) == 'function';
	}

	/**
	 * Formats error messages, calls the callback
	 * @method done
	 * @private
	 * @param cb {Function} callback
	 * @param [message] {Function} callback
	 * @return {Boolean} is the object valid or not?
	 */
	function _done(cb, message){
		var valid = false;

		if(typeof message === "string"){
			message = [message];

		}else if( Object.prototype.toString.call( message ) === '[object Array]' ) {
			if(message.length === 0){
				valid = true;
			}
		}else{
			valid = true;
		}

		if( _isFunction(cb)){
			if(valid){
				cb(valid, []);
			}else{
				cb(valid, message);
			}
		}

		return valid;
	}

	/**
	 * calls a custom definition if one is avalible for the given type
	 * @method _customDefinitions
	 * @private
	 * @param type {"String"} a GeoJSON object type
	 * @param object {Object} the Object being tested
	 * @return {Array} an array of errors
	 */
	function _customDefinitions(type, object){

		var errors;

		if(_isFunction(definitions[type])){
			try{
				errors = definitions[type](object);
			}catch(e){
				errors = ["Problem with custom definition for '" + type + ": " + e];
			}
			if(typeof result === "string"){
				errors = [errors];
			}
			if(Object.prototype.toString.call( errors ) === '[object Array]'){
				return errors;
			}
		}
		return [];
	}

	/**
	 * Define a custom validation function for one of GeoJSON objects
	 * @method define
	 * @param type {GeoJSON Type} the type
	 * @param definition {Function} A validation function
	 * @return {Boolean} Return true if the function was loaded corectly else false
	 */
	exports.define = function(type, definition){
		if((type in all_types) && _isFunction(definition)){
			//TODO: check to see if the type is valid
			definitions[type] = definition;
			return true;
		}
		return false;
	};

	/**
	 * Determines if an object is a position or not
	 * @method isPosition
	 * @param position {Array}
	 * @param [cb] {Function} the callback
	 * @return {Boolean}
	 */
	exports.isPosition = function(position, cb){

		var errors = [];

		//It must be an array
		if(Array.isArray(position)){
			//and the array must have more than one element
			if(position.length <= 1){
				errors.push("Postition must be at least two elements");
			}
		}else{
			errors.push("Postition must be an array");
		}

		//run custom checks
		errors = errors.concat(_customDefinitions("Position", position));

		return _done(cb, errors);
	};

	/**
	 * Determines if an object is a GeoJSON Object or not
	 * @method isGeoJSONObject|valid
	 * @param geoJSONObject {Object}
	 * @param [cb] {Function} the callback
	 * @return {Boolean}
	 */
	exports.isGeoJSONObject = exports.valid = function(geoJSONObject, cb){

		var errors = [];

		if('type' in geoJSONObject){
			if(non_geo_types[geoJSONObject.type]){
				return non_geo_types[geoJSONObject.type](geoJSONObject, cb)
			}else if(geo_types[geoJSONObject.type]){
				return geo_types[geoJSONObject.type](geoJSONObject, cb)
			}else{
				errors.push('type must be one of: "Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon", "GeometryCollection", "Feature", or "FeatureCollection"');
			}
		}else{
			errors.push("must have a member with the name 'type'");
		}

		//run custom checks
		errors = errors.concat(_customDefinitions("GeoJSONObject", geoJSONObject));
		return _done(cb, errors);
	};

	/**
	 * Determines if an object is a Geometry Object or not
	 * @method isGeometryObject
	 * @param geometryObject {Object}
	 * @param [cb] {Function} the callback
	 * @return {Boolean}
	 */
	exports.isGeometryObject = function(geometryObject, cb){
		var errors = [];

		if('type' in geometryObject){
			if(geo_types[geometryObject.type]){
				return geo_types[geometryObject.type](geometryObject, cb)
			}else{
				errors.push('type must be one of: "Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon" or "GeometryCollection"');
			}
		}else{
			errors.push("must have a member with the name 'type'");
		}

		//run custom checks
		errors = errors.concat(_customDefinitions("GeometryObject", geometryObject));
		return _done(cb, errors);
	};

	/**
	 * Determines if an object is a Point or not
	 * @method isPoint
	 * @param point {Object}
	 * @param [cb] {Function} the callback
	 * @return {Boolean}
	 */
	exports.isPoint = function(point, cb) {
		var errors = [];

		if('bbox' in point){
			exports.isBbox(point.bbox, function(valid, err){
				if(!valid){
					errors = errors.concat(err);
				}
			});
		}

		if('type' in point){
			if(point.type !== "Point"){
				errors.push("type must be 'Point'");
			}
		}else{
			errors.push("must have a member with the name 'type'");
		}

		if('coordinates' in point){
			exports.isPosition(point.coordinates, function(valid, err){
				if(!valid){
					errors.push('Coordinates must be a single position');
				}
			});
		}else{
			errors.push("must have a member with the name 'coordinates'");
		}

		//run custom checks
		errors = errors.concat(_customDefinitions("Point", point));

		return _done(cb, errors);
	};

	/**
	 * Determines if an array can be interperted as coordinates for a MultiPoint
	 * @method isMultiPointCoor
	 * @param coordinates {Array}
	 * @param [cb] {Function} the callback
	 * @return {Boolean}
	 */
	exports.isMultiPointCoor = function(coordinates, cb) {

		var errors = [];

		if(Array.isArray(coordinates)){
			coordinates.forEach(function(val, index){
				exports.isPosition(val, function(valid, err){
					if(!valid){
						//modify the err msg from "isPosition" to note the element number
						err[0] = "at "+ index+ ": ".concat(err[0]);
						//build a list of invalide positions
						errors = errors.concat(err);
					}
				});
			});
		}else{
			errors.push("coordinates must be an array");
		}

		return _done(cb, errors);
	}
	/**
	 * Determines if an object is a MultiPoint or not
	 * @method isMultiPoint
	 * @param position {Object}
	 * @param cb {Function} the callback
	 * @return {Boolean}
	 */
	exports.isMultiPoint = function(multiPoint, cb) {
		var errors = [];

		if('bbox' in multiPoint){
			exports.isBbox(multiPoint.bbox, function(valid, err){
				if(!valid){
					errors = errors.concat(err);
				}
			});
		}

		if('type' in multiPoint){
			if(multiPoint.type !== "MultiPoint"){
				errors.push("type must be 'MultiPoint'");
			}
		}else{
			errors.push("must have a member with the name 'type'");
		}

		if('coordinates' in multiPoint){
			exports.isMultiPointCoor(multiPoint.coordinates, function(valid, err){
				if(!valid){
					errors =  errors.concat(err);
				}
			});
		}else{
			errors.push("must have a member with the name 'coordinates'");
		}

		//run custom checks
		errors = errors.concat(_customDefinitions("MultiPoint", multiPoint));

		return _done(cb, errors);
	};

	/**
	 * Determines if an array can be interperted as coordinates for a lineString
	 * @method isLineStringCoor
	 * @param coordinates {Array}
	 * @param [cb] {Function} the callback
	 * @return {Boolean}
	 */
	exports.isLineStringCoor = function(coordinates, cb) {

		var errors = [];
		if(Array.isArray(coordinates)){
			if(coordinates.length > 1){
				coordinates.forEach(function(val, index){
					exports.isPosition(val, function(valid, err){
						if(!valid){
							//modify the err msg from "isPosition" to note the element number
							err[0] = "at "+ index+ ": ".concat(err[0]);
							//build a list of invalide positions
							errors = errors.concat(err);
						}
					});
				});
			}else{
				errors.push("coordinates must have at least two elements");
			}
		}else{
			errors.push( "coordinates must be an array");
		}

		return _done(cb, errors);
	}

	/**
	 * Determines if an object is a lineString or not
	 * @method isLineString
	 * @param lineString {Object}
	 * @param [cb] {Function} the callback
	 * @return {Boolean}
	 */
	exports.isLineString = function(lineString, cb){

		var errors = [];

		if('bbox' in lineString){
			exports.isBbox(lineString.bbox, function(valid, err){
				if(!valid){
					errors = errors.concat(err);
				}
			});
		}

		if('type' in lineString){
			if(lineString.type !== "LineString"){
				errors.push("type must be 'LineString'");
			}
		}else{
			errors.push("must have a member with the name 'type'");
		}

		if('coordinates' in lineString){
			exports.isLineStringCoor(lineString.coordinates, function(valid, err){
				if(!valid){
					errors =  errors.concat(err);
				}
			});
		}else{
			errors.push("must have a member with the name 'coordinates'");
		}

		//run custom checks
		errors = errors.concat(_customDefinitions("LineString", lineString));

		return _done(cb, errors);
	};

	/**
	 * Determines if an array can be interperted as coordinates for a MultiLineString
	 * @method isMultiLineStringCoor
	 * @param coordinates {Array}
	 * @param [cb] {Function} the callback
	 * @return {Boolean}
	 */
	exports.isMultiLineStringCoor = function(coordinates, cb) {
		var errors = [];
		if(Array.isArray(coordinates)){
			coordinates.forEach(function(val, index){
				exports.isLineStringCoor(val, function(valid, err){
					if(!valid){
						//modify the err msg from "isPosition" to note the element number
						err[0] = "at "+ index+ ": ".concat(err[0]);
						//build a list of invalide positions
						errors = errors.concat(err);
					}
				});
			});
		}else{
			errors.push("coordinates must be an array");
		}
		_done(cb, errors);
	}

	/**
	 * Determines if an object is a MultiLine String or not
	 * @method isMultiLineString
	 * @param multilineString {Object}
	 * @param [cb] {Function} the callback
	 * @return {Boolean}
	 */
	exports.isMultiLineString = function(multilineString, cb){

		var errors = [];

		if('bbox' in multilineString){
			exports.isBbox(multilineString.bbox, function(valid, err){
				if(!valid){
					errors = errors.concat(err);
				}
			});
		}

		if('type' in multilineString){
			if(multilineString.type !== "MultiLineString"){
				errors.push("type must be 'MultiLineString'");
			}
		}else{
			errors.push("must have a member with the name 'type'");
		}

		if('coordinates' in multilineString){
			exports.isMultiLineStringCoor(multilineString.coordinates, function(valid, err){
				if(!valid){
					errors = errors.concat(err);
				}
			});
		}else{
			errors.push("must have a member with the name 'coordinates'");
		}

		//run custom checks
		errors = errors.concat(_customDefinitions("MultiPoint", multilineString));

		return _done(cb, errors);
	};

	/**
	 * Determines if an array is a linear Ring String or not
	 * @method isMultiLineString
	 * @private
	 * @param coordinates {Array}
	 * @param [cb] {Function} the callback
	 * @return {Boolean}
	 */
	function _linearRingCoor(coordinates, cb) {

		var errors = [];
		if(Array.isArray(coordinates)){
			//4 or more positions

			coordinates.forEach(function(val, index){
				exports.isPosition(val, function(valid, err){
					if(!valid){
						//modify the err msg from "isPosition" to note the element number
						err[0] = "at "+ index+ ": ".concat(err[0]);
						//build a list of invalide positions
						errors = errors.concat(err);
					}
				});
			});

			// check the first and last positions to see if they are equivalent
			// TODO: maybe better checking?
			if(coordinates[0].toString() !== coordinates[coordinates.length -1 ].toString()){
				errors.push( "The first and last positions must be equivalent");
			}

			if(coordinates.length < 4){
				errors.push("coordinates must have at least four positions");
			}
		}else{
			errors.push("coordinates must be an array");
		}

		return _done(cb, errors);
	}

	/**
	 * Determines if an array is valid Polygon Coordinates or not
	 * @method _polygonCoor
	 * @private
	 * @param coordinates {Array}
	 * @param [cb] {Function} the callback
	 * @return {Boolean}
	 */
	exports.isPolygonCoor = function (coordinates, cb){

		var errors = [];
		if(Array.isArray(coordinates)){
			coordinates.forEach(function(val, index){
				_linearRingCoor(val, function(valid, err){
					if(!valid){
						//modify the err msg from "isPosition" to note the element number
						err[0] = "at "+ index+ ": ".concat(err[0]);
						//build a list of invalid positions
						errors = errors.concat(err);
					}
				});
			});
		}else{
			errors.push("coordinates must be an array");
		}

		return _done(cb, errors);
	}

	/**
	 * Determines if an object is a valid Polygon
	 * @method isPolygon
	 * @param polygon {Object}
	 * @param [cb] {Function} the callback
	 * @return {Boolean}
	 */
	exports.isPolygon = function(polygon, cb){

		var errors = [];

		if('bbox' in polygon){
			exports.isBbox(polygon.bbox, function(valid, err){
				if(!valid){
					errors = errors.concat(err);
				}
			});
		}

		if('type' in polygon){
			if(polygon.type !== "Polygon"){
				errors.push("type must be 'Polygon'");
			}
		}else{
			errors.push("must have a member with the name 'type'");
		}

		if('coordinates' in polygon){
			exports.isPolygonCoor(polygon.coordinates, function(valid, err) {
				if(!valid){
					errors = errors.concat(err);
				}
			});
		}else{
			errors.push("must have a member with the name 'coordinates'");
		}

		//run custom checks
		errors = errors.concat(_customDefinitions("Polygon", polygon));

		return _done(cb, errors);
	};

	/**
	 * Determines if an array can be interperted as coordinates for a MultiPolygon
	 * @method isMultiPolygonCoor
	 * @param coordinates {Array}
	 * @param [cb] {Function} the callback
	 * @return {Boolean}
	 */
	exports.isMultiPolygonCoor = function(coordinates, cb) {
		var errors = [];
		if(Array.isArray(coordinates)){
			coordinates.forEach(function(val, index){
				exports.isPolygonCoor(val, function(valid, err){
					if(!valid){
						//modify the err msg from "isPosition" to note the element number
						err[0] = "at "+ index+ ": ".concat(err[0]);
						//build a list of invalide positions
						errors = errors.concat(err);
					}
				});
			});
		}else{
			errors.push("coordinates must be an array");
		}

		_done(cb, errors);
	}

	/**
	 * Determines if an object is a valid MultiPolygon
	 * @method isMultiPolygon
	 * @param multiPolygon {Object}
	 * @param [cb] {Function} the callback
	 * @return {Boolean}
	 */
	exports.isMultiPolygon = function(multiPolygon, cb){

		var errors = [];

		if('bbox' in multiPolygon){
			exports.isBbox(multiPolygon.bbox, function(valid, err){
				if(!valid){
					errors = errors.concat(err);
				}
			});
		}

		if('type' in multiPolygon){
			if(multiPolygon.type !== "MultiPolygon"){
				errors.push("type must be 'MultiPolygon'");
			}
		}else{
			errors.push("must have a member with the name 'type'");
		}

		if('coordinates' in multiPolygon){
			exports.isMultiPolygonCoor(multiPolygon.coordinates, function(valid, err){
				if(!valid){
					errors = errors.concat(err);
				}
			});
		}else{
			errors.push("must have a member with the name 'coordinates'");
		}

		//run custom checks
		errors = errors.concat(_customDefinitions("MultiPolygon", multiPolygon));

		return _done(cb, errors);
	};

	/**
	 * Determines if an object is a valid Geometry Collection
	 * @method isGeometryCollection
	 * @param geometryCollection {Object}
	 * @param [cb] {Function} the callback
	 * @return {Boolean}
	 */
	exports.isGeometryCollection = function(geometryCollection, cb){
		var errors = [];

		if('bbox' in geometryCollection){
			exports.isBbox(geometryCollection.bbox, function(valid, err){
				if(!valid){
					errors = errors.concat(err);
				}
			});
		}

		if('type' in geometryCollection){
			if(geometryCollection.type !== "GeometryCollection"){
				errors.push("type must be 'GeometryCollection'");
			}
		}else{
			errors.push("must have a member with the name 'type'");
		}

		if('geometries' in geometryCollection){
			if(Array.isArray(geometryCollection.geometries)){
				geometryCollection.geometries.forEach(function(val, index){
					exports.isGeometryObject(val, function(valid, err){
						if(!valid){
							//modify the err msg from "isPosition" to note the element number
							err[0] = "at "+ index+ ": ".concat(err[0]);
							//build a list of invalide positions
							errors = errors.concat(err);
						}
					});
				});
			}else{
				errors.push("'geometries' must be an array");
			}
		}else{
			errors.push("must have a member with the name 'geometries'");
		}

		//run custom checks
		errors = errors.concat(_customDefinitions("GeometryCollection", geometryCollection));

		return _done( cb, errors);
	};

	/**
	 * Determines if an object is a valid Feature
	 * @method isFeature
	 * @param feature {Object}
	 * @param [cb] {Function} the callback
	 * @return {Boolean}
	 */
	exports.isFeature = function(feature, cb){

		var errors = [];

		if('bbox' in feature){
			exports.isBbox(feature.bbox, function(valid, err){
				if(!valid){
					errors = errors.concat(err);
				}
			});
		}

		if('type' in feature){
			if(feature.type !== "Feature"){
				errors.push("type must be 'feature'");
			}
		}else{
			errors.push("must have a member with the name 'type'");
		}

		if(!('properties' in feature)){
			errors.push("must have a member with the name 'properties'");
		}

		if('geometry' in feature){
			if(feature.geometry !== null){
				exports.isGeometryObject(feature.geometry, function(valid, err){
					if(!valid){
						errors = errors.concat(err);
					}
				});
			}
		}else{
			errors.push("must have a member with the name 'geometry'");
		}

		//run custom checks
		errors = errors.concat(_customDefinitions("Feature", feature));

		return _done(cb, errors);
	};

	/**
	 * Determines if an object is a valid Feature Collection
	 * @method isFeatureCollection
	 * @param featureCollection {Object}
	 * @param [cb] {Function} the callback
	 * @return {Boolean}
	 */
	exports.isFeatureCollection = function(featureCollection, cb){

		var errors = [];

		if('bbox' in featureCollection){
			exports.isBbox(featureCollection.bbox, function(valid, err){
				if(!valid){
					errors = errors.concat(err);
				}
			});
		}

		if('type' in featureCollection){
			if(featureCollection.type !== "FeatureCollection"){
				errors.push("type must be 'FeatureCollection'");
			}
		}else{
			errors.push("must have a member with the name 'type'");
		}


		if('features' in featureCollection){
			if(Array.isArray(featureCollection.features)){
				featureCollection.features.forEach(function(val, index){
					exports.isFeature(val, function(valid, err){
						if(!valid){
							//modify the err msg from "isPosition" to note the element number
							err[0] = "at "+ index+ ": ".concat(err[0]);
							//build a list of invalide positions
							errors = errors.concat(err);
						}
					});
				});
			}else{
				errors.push("'features' must be an array");
			}
		}else{
			errors.push("must have a member with the name 'features'");
		}

		//run custom checks
		errors = errors.concat(_customDefinitions("FeatureCollection", featureCollection));

		return _done(cb, errors);
	};

	/**
	 * Determines if an object is a valid Bounding Box
	 * @method isBbox
	 * @param bbox {Object}
	 * @param [cb] {Function} the callback
	 * @return {Boolean}
	 */
	exports.isBbox = function(bbox, cb){
		var errors = [];
		if(Array.isArray(bbox)){
			if(bbox.length % 2 !== 0){
				errors.push("bbox, must be a 2*n array");
			}
		}else{
			errors.push("bbox must be an array");
		}

		//run custom checks
		errors = errors.concat(_customDefinitions("Bbox", bbox));

		_done(cb,errors);
	};

	var non_geo_types = {
			"Feature": exports.isFeature,
			"FeatureCollection": exports.isFeatureCollection
		},

		geo_types = {
			"Point": exports.isPoint,
			"MultiPoint": exports.isMultiPoint,
			"LineString": exports.isLineString,
			"MultiLineString": exports.isMultiLineString,
			"Polygon": exports.isPolygon,
			"MultiPolygon": exports.isMultiPolygon,
			"GeometryCollection": exports.isGeometryCollection,
		},

		all_types = {
			"Feature": exports.isFeature,
			"FeatureCollection": exports.isFeatureCollection,
			"Point": exports.isPoint,
			"MultiPoint": exports.isMultiPoint,
			"LineString": exports.isLineString,
			"MultiLineString": exports.isMultiLineString,
			"Polygon": exports.isPolygon,
			"MultiPolygon": exports.isMultiPolygon,
			"GeometryCollection": exports.isGeometryCollection,
			"Bbox": exports.isBox,
			"Position": exports.isPosition,
			"GeoJSON": exports.isGeoJSONObject,
			"GeometryObject": exports.isGeometryObject
		};

	exports.all_types = all_types;

})(typeof exports === 'undefined'? this['GJV']={}: exports);