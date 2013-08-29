var fs = require('fs');

// Assert that we have a configuration file
if ( ! fs.exists('config.json') || ! fs.isFile('config.json')) {
	require('system').stderr.writeLine('\nConfiguration file "config.json" not found in application root directory. Terminating.');
	phantom.exit(1);
} else {
	console.log('Using configuration file: '+fs.absolute('config.json'));
}

phantom.injectJs('js/utils.js');
phantom.injectJs('js/gjv.js');

var ctx = new function() {
	this.config = JSON.parse(fs.read('config.json'));
	this.page = null;
	this.scannerEnabled = !!this.config.autoRunScanner;
};

var debug = {
	muted: ctx.config.mutedLogTypes,
	log: function(type, msg, msg2) {
		if (-1 === this.muted.indexOf(type))
			console.log('['+type+'] ', msg || '', msg2 || '');
	}
};
debug.error = debug.log;

var IServer = {
	isClientLoaded: function() {
		return !!ctx.page.evaluate(function() {
			return window.iitcLoaded;
		});
	},
	captureScreenshot: function(title, timeout) {
		title = title || page.evaluate(function() { return document.title; });
		var ts = new Date(),
			fname = ts.toLocaleDateString()+' '+ts.toLocaleTimeString()+'_'+title+'.png';
		if (undefined === timeout) {
			console.log('CAPTURING SCREENSHOT: '+fname);
			ctx.page.render(fname);
		} else {
			window.setTimeout(function() {
				console.log('CAPTURING SCREENSHOT: '+fname);
				ctx.page.render(fname);
			}, parseInt(timeout));
		}
	},
	timestamp: function() {
		var d = new Date();
		return ('0'+d.getHours()).slice(-2)+':'+ ('0'+d.getMinutes()).slice(-2)+':'+ ('0'+d.getSeconds()).slice(-2);
	},
	muteClient: function(choice) {
		ctx.page.evaluate(function(choice) {
			IClient.mute(choice);
		}, !!choice);
	}
};

IServer.Map = {
	boundingBoxAroundCoords: function(coords) {
		var xAll = [], yAll = [];

		for (var i = 0; i < coords.length; i++) {
			xAll.push(coords[i][1]);
			yAll.push(coords[i][0]);
		}

		xAll = xAll.sort(function (a,b) { return a - b });
		yAll = yAll.sort(function (a,b) { return a - b });

		return [ [xAll[0], yAll[0]], [xAll[xAll.length - 1], yAll[yAll.length - 1]] ];
	}
};

IServer.Scanner = {
	scanFields: function(fields, onFinish) {
		var next = (function(fields, onFinish, idx) {
			return function() {
				if (idx >= fields.length) {
					debug.log('SCANNER', IServer.timestamp()+': All fields have been scanned. Done.');
					if (typeof onFinish === 'function') onFinish(fields);
					return false;
				}
				debug.log('SCANNER', IServer.timestamp()+': Scanning field', JSON.stringify(fields[idx]));
				IServer.Scanner.scanField(fields[idx++], arguments.callee);
			};
		})(fields, onFinish, 0);
		next();
	},

	scanField: function(sectors, onFinish) {
		var next = (function(sectors, onFinish, idx) {
			return function() {
				if (idx >= sectors.length) {
					debug.log('SCANNER', IServer.timestamp()+': Finished field scan');
					window.setTimeout(function() {
						if (typeof onFinish === 'function') onFinish(sectors);
					}, ctx.config.pauseAfterFieldScan * 1000);
					return false;
				}
				IServer.Scanner.scanSector(sectors[idx++], arguments.callee);
			};
		})(sectors, onFinish, 0);
		next();
	},

	scanSector: function(bbox, onFinish) {
		debug.log('SCANNER', IServer.timestamp()+': Scanning sector', JSON.stringify(bbox));
		ctx.page.evaluate(function(latLngBounds) {
			window.map.fitBounds(latLngBounds);
		}, bbox);
		window.setTimeout(function () {
			debug.log('SCANNER', IServer.timestamp()+': Finished sector scan');
			if (typeof onFinish === 'function') onFinish(bbox);
		}, ctx.config.pauseAfterSectorScan * 1000);
	},

	scan: function(onComplete, debugTiles) {
		var scheduleDataFpath = ctx.config.scheduleDataFile,
			scheduleData = null,
			features = [];
		if (fs.exists(scheduleDataFpath) && fs.isFile(scheduleDataFpath)) {
			try {
				scheduleData = JSON.parse(fs.read(scheduleDataFpath));
				features = scheduleData.features;
			} catch(exc) {
				console.log(JSON.stringify(scheduleData));
			}

			debug.log('SCANNER', 'Parsed schedule data file contains '+features.length+' features');

			// Prepare scan
			var debugFeatures = [];
			var fields = [],
				viewportBBox = page.evaluate(function(zoom) {
					// Adjust zoom level so that we can see neutral portales
					window.map.setZoom(zoom || 17);
					return window.map.getBounds().toBBoxString()
						.split(',').map(function(el) { return parseFloat(el); });
				}, ctx.config.defaultZoom),
				dX = viewportBBox[2] - viewportBBox[0],
				dY = viewportBBox[3] - viewportBBox[1];

			// Translate field boundaries into Ingress tiles
			for (var i=0, j=features.length, feat, bbox; i < j; i++) {
				feat = features[i];
				if ('Polygon' !== feat.geometry.type) continue;
				// Calculate boundary rectangle
				bbox = IServer.Map.boundingBoxAroundCoords(feat.geometry.coordinates[0]);
				debug.log('INFO', 'Found Polygon feature object', JSON.stringify(bbox));
				// Generate LatLng boundaries that can directly be consumed by Leaflet
				var nSectors = 0,
					sectors = [];
				for (var y=bbox[0][0], yMax=bbox[1][0]; y < yMax; y += dY) {
					for (var x=bbox[0][1], xMax=bbox[1][1]; x < xMax; x += dX) {
						var y2 = y + dY,
							x2 = x + dX;
						debug.log('SCANNER', 'Added sector #'+(++nSectors)+' to field #'+(1+fields.length)+': ('+x+','+y+'),('+x2+','+y2+')');
						sectors.push([[y, x], [y2, x2]]);
						// Save field boundaries in format that can be plotted by Leaflet
						// for debugging purposes
						if (debugTiles) debugFeatures.push({
							"type": "Feature",
							"properties": { sectorIdx: scanCounter },
							"geometry": {
								"type": "Polygon",
								"coordinates": [ [ [x, y], [x, y+dY], [x+dX, y+dY], [x+dX, y], [x, y] ] ]
							}
						});
					}
				}
				fields.push(sectors);
			}

			// Scan tiles
			debug.log('SCANNER', IServer.timestamp()+': Going to scan '+fields.length+' fields');
			IServer.Scanner.scanFields(fields, onComplete);
			if (debugTiles) return {
				"type": "FeatureCollection",
				"features": debugFeatures
			};
		}
	}
};

IServer.RPC = {
	archiveFactionMsgs: function(msgs) {
		debug.log('RPC', 'Archiving '+msgs.result.length+' faction chat messages');
	},
	archivePublicMsgs: function(msgs) {
		debug.log('RPC', 'Archiving '+msgs.result.length+' public chat messages');
	},
	archivePortalData: function(data) {
		debug.log('RPC', 'Archiving portal data', JSON.stringify(data));
	}
};

// BEGIN initializer
IServer.initialize = function() {
	// Attach global error handler
	phantom.onError = function(msg, trace) {
		var msgStack = ['PHANTOM ERROR: ' + msg];
		if (trace && trace.length) {
			msgStack.push('TRACE:');
			trace.forEach(function(t) {
				msgStack.push(' -> ' + (t.file || t.sourceURL) + ': ' + t.line + (t.function ? ' (in function ' + t.function + ')' : ''));
			});
		}
		debug.log('GLOBAL_ERROR', msgStack.join('\n'));
		IServer.shutdown('afterError');
	};

	// Install screenshot webservice
	ctx.ssPort = 9001;
	ctx.ssServer = require('webserver').create();
	ctx.ssServiceAvail = ctx.ssServer.listen(ctx.ssPort, function (req, resp) {
		var caption = 'Screenshot at ' + new Date();
		debug.log('ScreenshotService', 'Screenshot requested at ' + new Date());
		resp.writeHead(200, {
			'Cache': 'no-cache',
			'Content-Type': 'text/html'
		});
		resp.write('<html><head><title>'+caption+'</title></head><body>');
		resp.write('<div style="text-align:center;">');
		resp.write('<p>'+caption+' &nbsp;&nbsp;<span><input type="checkbox" id="autorefresh" checked/>Auto-refresh</span></p><p><img src="data:image/png;base64,'+ctx.page.renderBase64('PNG')+'" width="70%"/></p></div>');
		resp.write('<script type="text/javascript">setInterval(function(){ if(document.getElementById("autorefresh").checked)location.reload();}, 10*1000);</script></body></html>');
		resp.close();
	});
	console.log((ctx.ssServiceAvail)
		? '[SUCCESS] Screenshot webservice available on port '+ctx.ssPort
		: '[FAIL] Screnshot webservice could not be started on port '+ctx.ssPort);

	// Install scanner schedule editor service
	ctx.schedulerPort = 9002;
	ctx.schedulerServer = require('webserver').create();
	ctx.schedulerServiceAvail = ctx.schedulerServer.listen(ctx.schedulerPort, function (req, resp) {
		if ('GET' === req.method && (/^\/(?:assets|js)\//).test(req.url)) {
			// Static file requested
			// TODO: Sanitize resource url before using it as file path (directory traversal asf.)
			var fpath = '.'+req.url;
			if (fs.exists(fpath) && fs.isFile(fpath)) {
				var ext = fpath.substr(1 + fpath.lastIndexOf('.')),
					isImg = (/(png|jpg|jpeg|gif)/i).test(ext),
					mime = (isImg ? 'image' : 'text') + '/' + ext,
					fStream = fs.open(fpath, isImg ? 'rb' : 'r');

				debug.log('SchedulerService', 'Client requested static file: "'+req.url+'", '+mime+', '+fs.size(fpath)+'B');
				resp.statusCode = 200;
				resp.setHeader('Content-Type', mime);
				resp.setHeader('Cache-Control', 'max-age=31556926');
				resp.setHeader('Content-Length', fs.size(fpath));
				if (isImg) resp.setEncoding('binary');
				resp.write(fStream.read());
			} else {
				debug.log('SchedulerService', 'Requested resource not found or is not a file: "'+req.url+'"');
				resp.writeHead(404, { 'Content-Type': 'text/plain' });
				resp.write('404 – Ooops!');
			}
			resp.closeGracefully();
			return;
		}

		var respData = null;

		// Route to scheduler
		if ('/scheduler' === req.url) {
			var schedDataFpath = fs.absolute(ctx.config.scheduleDataFile);
			// Just serve editor file?
			if ('GET' === req.method) {
				var caption = 'Editor page requested at ' + new Date();
				debug.log('SchedulerService', caption);
				resp.writeHead(200, {
					'Content-Type': 'text/html',
					'Cache-Control': 'no-cache',
					'Cache': 'no-cache'
				});
				// Load editor file and embed GeoJSON data file
				var htmlDoc = fs.read(ctx.config.schedulerHtmlFile);
				if (fs.exists(schedDataFpath) && fs.isFile(schedDataFpath))
					htmlDoc = htmlDoc.replace('/*GEOJSON_OBJ*/', fs.read(schedDataFpath));
				resp.write(htmlDoc);

			// Or update schedule database?
			} else if ('POST' === req.method && 0 === req.headers['Content-Type'].indexOf('application/json')) {
				debug.log('SchedulerService', 'Schedule data update attempted');
				// Parse request data
				var parseSucc = false;
				try {
					var scheduleData = JSON.parse(req.post);
					parseSucc = true;
				} catch(exc) {
					var errMsg = 'Error parsing JSON POST data: '+exc.message;
					debug.log('ERROR', errMsg);
					resp.writeHead(500, { 'Content-Type': 'text/html' });
					resp.write('<pre>'+errMsg+'</pre>');
					resp.close();
					return;
				}
				// Process+persist data
				respData = {};
				if (parseSucc && scheduleData && GJV.valid(scheduleData)) {
					debug.log('SchedulerService', 'Schedule data successfully parsed');
					try {
						fs.write(schedDataFpath, req.post);
						debug.log('SchedulerService', 'Schedule database in file "'+schedDataFpath+'" updated');
						respData.status = 0;
					} catch(exc) {
						debug.log('SchedulerService', 'ERROR: Could not write schedule data to file "'+schedDataFpath+'": '+exc.message);
						respData.status = 1;
						respData.message = exc.message;
					}
				} else {
					debug.log('SchedulerService', 'ERROR: Received data is no valid GeoJSON data. Ignoring.');
					respData.status = 0;
					respData.message = 'Received data is no valid GeoJSON data. Ignoring.';
				}
			}
		}

		// Route to scanner
		if ('/scanner/status' === req.url) {
			if ('POST' === req.method) {
				var postData = JSON.parse(req.post);
				ctx.scannerEnabled = !!postData.enabled;
				respData = {
					status: 0,
					message: 'Scanner turned ' + ((ctx.scannerEnabled) ? 'ON' : 'OFF')
				};
			} else if ('GET' === req.method) {
				respData = {
					status: 0,
					message: (ctx.scannerEnabled) ? 'on' : 'off',
					enabled: ctx.scannerEnabled
				};
			}
		}

		// Answer request
		if (null === respData) {
			debug.log('SchedulerService', 'Requested resource not found: "'+req.url+'"');
			resp.writeHead(404, { 'Content-Type': 'text/plain' });
			resp.write('404 – Ooops!');
		} else {
			resp.writeHead(200, {
				'Content-Type': 'application/json; charset=UTF-8',
				'Cache': 'no-cache',
				'Cache-Control': 'no-cache'
			});
			resp.write(JSON.stringify(respData));
		}
		// Done
		resp.closeGracefully();
	});
	console.log((ctx.schedulerServiceAvail)
		? '[SUCCESS] ScheduleEditor webservice available on port '+ctx.schedulerPort
		: '[FAIL] ScheduleEditor webservice could not be started on port '+ctx.schedulerPort);

	// Create default page
	ctx.page = require('webpage').create().extend({
		onConsoleMessage: function(msg, lineNum, sourceId) {
			var loc = '';
			if (lineNum !== undefined && sourceId !== undefined) {
				loc = ' (from line #' + lineNum + ' in "' + sourceId + '")';
			}
			debug.log('CONSOLE', '' + msg + loc);
		},
		onLoadFinished: function(status) {
			debug.log('PAGE', 'Page loaded: "' + status, arguments.constructor.name + '"');
		},
		onLoadStarted: function() {
			var currentUrl = page.evaluate(function() {
				return window.location.href;
			});
			debug.log('PAGE', 'Loading: "' + currentUrl + '"');
		},
		onError: function(msg, trace) {
			var msgStack = ['ERROR: ' + msg];
			if (trace && trace.length) {
				msgStack.push('TRACE:');
				trace.forEach(function(t) {
					msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function + '")' : ''));
				});
			}
			debug.log('PAGE', 'ERROR: ' + msgStack.join('\n'));
		},
		onCallback: function(evtData) {
			if ('rpc' === evtData.type) {
				var m = evtData.method;
				if (typeof IServer.RPC[m] === 'function') {
					debug.log('RPC', 'Received method call to "'+m+'"');
					return IServer.RPC[m](evtData.payload);
				} else {
					debug.log('RPC', 'ERROR: No method "'+m+'" found');
				}
			}
		}
	});

}; // END initializer

// BEGIN shutdown
IServer.shutdown = function(status, code) {
	if (arguments.length == 0) code = 0;

	if (ctx.ssServiceAvail) ctx.ssServer.close();
	if (ctx.schedulerServiceAvail) ctx.schedulerServer.close();

	switch (status) {
		case 'afterError':
			debug.log('EXIT', 'Terminating IITC server after a global error occured');
			break;
		default:
			debug.log('EXIT', 'Bye');
			break;
	}

	phantom.exit(code || 0);
}; // END shutdown


// Application
IServer.initialize();

var page = ctx.page;
page.viewportSize = ctx.config.browserViewport;
debug.log('APP', 'Loading Intel website');
page.open('http://www.ingress.com/intel', function(status) {
	if (status !== 'success') {
		debug.error('APP', 'ERROR: Intel website could not be loaded. Terminating. (' + status + ')');
		IServer.shutdown('pageLoadError', 1);
		return;
	}

	// Assert user is logged on
	var authUrl = page.evaluate(function() {
			var url = '',
				anchors = document.getElementsByTagName('a');
			for (var i=0, j=anchors.length; i < j; i++) {
				if ('Sign in' == anchors[i].text) {
					url = anchors[i].href;
					break;
				}
			}
			return url;
		});

	if (authUrl.length > 0) {
		debug.log('APP', 'Initiating user session');
		debug.log('APP', 'Redirecting to auth URL: '+authUrl);
		page.open(authUrl, function() {
			if (status !== 'success') {
				debug.error('APP', 'Page not successfully opened. Terminating. Mesage: ' + status);
				IServer.shutdown('pageLoadError', 1);
			}
			debug.log('APP', 'Google login page loaded');
			page.evaluate(function() {
				document.querySelector('input[name=Email]').value = ctx.config.username;
				document.querySelector('input[name=Passwd]').value = ctx.config.password;
				document.getElementById('gaia_loginform').submit();
			});
			debug.log('APP', 'User credentials filled in and form submitted');
		});
	} else {
		debug.log('APP', 'Assuming that user session exists and being still active');
	}

	// TODO: Fetch latest release `curl 'http://iitc.jonatkins.com/release/total-conversion-build.user.js'`
	// TODO: Host JS code on external server and use includeJs with callback instead of setTimeouts
	// Bullshit, `includeJs` doesnt load local resources
	page.injectJs('js/iitc.latest.js');
	page.injectJs('js/iitc-client.js');

	window.setTimeout(function() {
		debug.log('APP', 'Waiting for IClient to be initialized');
		if (IServer.isClientLoaded()) {
			debug.log('APP', 'Client initialized. Now running startup script');
			page.evaluate(function() {
				IClient.hideDialogs();
				IClient.mute(true);
			});

			// Scan scheduled areas
			var onScanComplete = function() {
					IServer.muteClient(true);
					window.setTimeout(afterScanPause, ctx.config.pauseBeforeRescan * 1000);
				},
				afterScanPause = function() {
					if (ctx.scannerEnabled) {
						debug.log('SCANNER', IServer.timestamp()+': Starting scan');
						IServer.muteClient(false);
						IServer.Scanner.scan(onScanComplete);
					} else {
						var retryAfter = ctx.config.pauseBeforeRescan * 2;
						debug.log('SCANNER', IServer.timestamp()+': Scanner stopped. Retry in '+retryAfter+' seconds.');
						window.setTimeout(arguments.callee, retryAfter * 1000);
					}
				};
			afterScanPause();

			// TODO: Munge data and persist it. Listen to onScanComplete event.

		} else {
			window.setTimeout(arguments.callee, 3000);
		}
	}, 3000);

});