var IClient = {

    ctx: null,

    initialize: function() {
        if (null !== this.ctx) {
            throw(
                'Client can only be initialized once');
        }
        // Create context
        this.ctx = {
            win: window,
            doc: document,
            map: window.map,
            jquery: window.jQuery,
            muted: true
        };
    }, // END initializer

    shutdown: function() {

    }, // END shutdown

    setMessageChannel: function(name, maximized) {
        window.chat.show(name);
        // Dont know why the map gets disabled by default!?!
        $('#map').css('visibility', 'visible');
    },

    getContext: function() {
        return this.ctx;
    },

    hideDialogs: function() {
        if (null === this.ctx) return this;
        this.ctx.jquery('body > *:not(#map), #map > .leaflet-control-container, #map .gmnoprint, img[src="http://maps.gstatic.com/mapfiles/google_white.png"]').hide();
        return this;
    },

    showDialogs: function() {
        if (null === this.ctx) return this;
        this.ctx.jquery('body > *:not(#map), #map > .leaflet-control-container, #map .gmnoprint, img[src="http://maps.gstatic.com/mapfiles/google_white.png"]').show();
        return this;
    },

    doRPC: function(method, payload) {
        return window.callPhantom({
            type: 'rpc',
            method: method,
            payload: payload
        });
    },

    mute: function(choice) {
        this.ctx.muted = !!choice;
    }
};

IClient.Places = {
    Neumarkt: {
        ll: new L.LatLng(49.281412, 11.461487),
        zoom: 16
    },
    Nürnberg: {
        ll: new L.LatLng(49.43464531038392, 11.072330474853516),
        zoom: 13
    }
};

IClient.Map = {
    zoomIn: function() {
        var evt = document.createEvent("MouseEvents");
        evt.initMouseEvent("click", true, true, window,
            0, 0, 0, 0, 0, false, false, false, false, 0, null);
        document.querySelector('a.leaflet-control-zoom-in').dispatchEvent(evt);
        return this;
    },
    zoomOut: function() {
        var evt = document.createEvent("MouseEvents");
        evt.initMouseEvent("click", true, true, window,
            0, 0, 0, 0, 0, false, false, false, false, 0, null);
        document.querySelector('a.leaflet-control-zoom-out').dispatchEvent(evt);
        return this;
    },
    setBaseType: function(name) {
        var baseLayers = window.layerChooser.getLayers().baseLayers;

        // Abort if unknown base type was supplied
        if (-1 === [
            'ingress', 'osm', 'roads', 'satellite', 'hybrid', 'terrain'
        ].indexOf(name)) {
            return;
        }

        for (var i = 0, j = baseLayers.length; i < j; i++) {
            if (-1 !== baseLayers[i].name.toLowerCase().indexOf(name)) {
                window.layerChooser.showLayer(baseLayers[i].layerId, true);
                break;
            }
        }
    },
    getState: function() {
        var map = IClient.getContext().map;
        return {
            center: map.getCenter(),
            zoom: map.getZoom(),
            minZoom: map.getMinZoom(),
            maxZoom: map.getMaxZoom(),
            bounds: map.getBounds(),
            size: map.getSize(),
            pxBounds: map.getPixelBounds(),
            pxOrigin: map.getPixelOrigin()
        };
    },
    setScanArea: function(latLngBounds) {
        IClient.getContext().map.fitBounds(latLngBounds);
        // TODO: Introduce async callback to IServer once all data was loaded
    }
};

window.addHook('iitcLoaded', function() {
    IClient.initialize();

    // Prevent IDLE timeout
    // @see total-conversion-build.user.js, lines 4495–4552
    document.hidden = false;
    window.setInterval(function() {
        jQuery('body').trigger('keypress');
        window.idleTime = 0;
    }, window.MAX_IDLE_TIME - 200)

    window.addHook('factionChatDataAvailable', function(data) {
        if ( ! IClient.ctx.muted)
            IClient.doRPC('archiveFactionMsgs', data.raw);
    });
    window.addHook('publicChatDataAvailable', function(data) {
        if ( ! IClient.ctx.muted)
            IClient.doRPC('archivePublicMsgs', data.raw);
    });
    window.addHook('mapDataRefreshEnd', function(data) {
        if (IClient.ctx.muted) return;
        var ctx = IClient.ctx,
            currMapView = ctx.map.getBounds(),
            portals = ctx.win.portals,
            guids = Object.getOwnPropertyNames(portals),
            pData = [];

        // Only select portals which are in current scan area
        for (var i = 0, j = guids.length, k; i < j; i++) {
            k = portals[guids[i]];
            if (currMapView.contains(k.getLatLng())) {
                pData[pData.length] = k.options.ent;
            }
        }

        IClient.doRPC('archivePortalData', pData);
    });

    // TODO: Check when all portals in current viewport are loaded, collect their data and pass to IServer
});
