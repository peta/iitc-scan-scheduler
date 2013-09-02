var IClient = {

    ctx: null,

    initialize: function() {
        if (null !== this.ctx) throw(
            'Client can only be initialized once');
        // Create context
        this.ctx = {
            win: window,
            doc: document,
            map: window.map,
            jquery: window.jQuery,
            muted: true,
            tmpScanData: null
        };

        // Alter IITC behaviour

        // Add custom events so that we can use IITC infrastructure
        window.VALID_HOOKS.push(
            'publicChatDataLoaded',
            'factionChatDataLoaded',
            'allChatDataLoaded'
        );

        // In order to avoid successive loads of chat data, we slightly
        // raise the number of chat messages being requested by default
        // TODO: Verify if we do really benefit from this
        window.CHAT_PUBLIC_ITEMS *= 2;
        window.CHAT_FACTION_ITEMS *= 2;

        // Assert that we can determine when all chat has been loaded (regardless if there is any)
        var oldHandleFactionChat = window.chat.handleFaction;
        window.chat.handleFaction = function(data, olderMsgs) {
            var ret = oldHandleFactionChat.apply(window.chat, arguments);
            if(data && Array === data.result.constructor
                    && data.result.length < window.CHAT_FACTION_ITEMS)
                window.runHooks('factionChatDataLoaded');
            return ret;
        };
        var oldHandlePublicChat = window.chat.handlePublic;
        window.chat.handlePublic = function(data, olderMsgs) {
            var ret = oldHandlePublicChat.apply(window.chat, arguments);
            if(data && Array === data.result.constructor
                    && data.result.length < window.CHAT_PUBLIC_ITEMS)
                window.runHooks('publicChatDataLoaded');
            return ret;
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

    sendEvent: function(evtName, evtData) {
        return window.callPhantom({
            type: 'event',
            event: evtName,
            data: evtData
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

    startScan: function(latLngBounds) {
        var ctx = IClient.getContext();
        // Abort all pending chat/portal data requests
        window.requests.abort();
        // Create new state object
        ctx.tmpScanData = {
            timestamp: Date.now(),
            area: latLngBounds,
            portalsLoaded: false,
            portals: [],
            chatLoaded: false,
            chat: {
                publicLoaded: false,
                public: [],
                factionLoaded: false,
                faction: []
            }
        };
        ctx.map.fitBounds(latLngBounds);
        // TODO: Introduce async callback to IServer once all data was loaded
    },

    stopScan: function() {
        var ctx = IClient.getContext(),
            tmpData = ctx.tmpScanData;
        console.log('Stopping scan operation. Chat data loaded? '+
            (tmpData.chatLoaded ? 'YES' : 'NO')+'  Portal data loaded? '+ (tmpData.portalsLoaded ? 'YES' : 'NO'));
        ctx.tmpScanData = null;
        // Tell server that scan has been stopped
        return IClient.sendEvent('client:scanStopped', {
            chat: tmpData.chat,
            portals: tmpData.portals
        });
    }
};

window.addHook('iitcLoaded', function() {
    IClient.initialize();
    var ctx = IClient.getContext();

    // Prevent IDLE timeout
    // @see total-conversion-build.user.js, lines 4495–4552
    document.hidden = false;
    window.setInterval(function() {
        jQuery('body').trigger('keypress');
        window.idleTime = 0;
    }, Math.max(window.MAX_IDLE_TIME-10, 10) * 1000);

    // Keep track of when both, chat and portal data is fully loaded, so that we can proceed with next sector

    window.addHook('factionChatDataAvailable', function(data) {
        console.log('FACTION chat data available: '+data.raw.result.length+' message(s)');
        if (ctx.tmpScanData)
            ctx.tmpScanData.chat.faction.push(data.raw);
    });
    window.addHook('publicChatDataAvailable', function(data) {
        console.log('PUBLIC chat data available: '+data.raw.result.length+' message(s)');
        if (ctx.tmpScanData)
            ctx.tmpScanData.chat.public.push(data.raw);
    });
    window.addHook('publicChatDataLoaded', function() {
        console.log('All PUBLIC chat data loaded');
        if (ctx.tmpScanData) {
            var chatData = ctx.tmpScanData.chat;
            chatData.publicLoaded = true;
            if (chatData.factionLoaded)
                window.runHooks('allChatDataLoaded');
        }
    });
    window.addHook('factionChatDataLoaded', function() {
        console.log('All FACTION chat data loaded');
        if (ctx.tmpScanData) {
            var chatData = ctx.tmpScanData.chat;
            chatData.factionLoaded = true;
            if (chatData.publicLoaded)
                window.runHooks('allChatDataLoaded');
        }
    });
    window.addHook('allChatDataLoaded', function() {
        console.log('All chat data loaded');
        var tmpData = ctx.tmpScanData;
        if (null === tmpData) return;
        // Update+check state
        tmpData.chatLoaded = true;
        if (tmpData.portalsLoaded)
            IClient.Map.stopScan();
    });
    window.addHook('mapDataRefreshEnd', function(data) {
        console.log('All portal data loaded');
        var tmpData = ctx.tmpScanData;
        if (null === tmpData) return;

        var currMapView = ctx.map.getBounds(),
            portals = ctx.win.portals,
            guids = Object.getOwnPropertyNames(portals),
            pData = tmpData.portals;

        // Only select portals which are in current scan area
        for (var i = 0, j = guids.length, k; i < j; i++) {
            k = portals[guids[i]];
            if (currMapView.contains(k.getLatLng()))
                pData[pData.length] = k.options.ent;
        }

        // Update+check state
        tmpData.portalsLoaded = true;
        if (tmpData.chatLoaded)
            IClient.Map.stopScan();
    });
});
