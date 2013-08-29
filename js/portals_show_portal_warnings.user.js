// ==UserScript==
// @id             iitc-plugin-show-portal-warnings@macrojames
// @name           IITC plugin: show portal warnings
// @version        2.17-20130822.102751
// @namespace      https://github.com/breunigs/ingress-intel-total-conversion
// @description    [local-2013-08-22-102751] Show Alert if new L7+ Portal is built for enl-Regensburg, track upgrades
// @updateURL      https://dl.dropboxusercontent.com/u/86505156/upgradetracker/portals_show_portal_warnings.meta.js
// @downloadURL    https://dl.dropboxusercontent.com/u/86505156/upgradetracker/portals_show_portal_warnings.user.js
// @include        https://www.ingress.com/intel*
// @include        http://www.ingress.com/intel*
// @match          https://www.ingress.com/intel*
// @match          http://www.ingress.com/intel*
// @grant          none
// ==/UserScript==

/**
 * UPDATE:
 * 2.17 catch errors when portals have no address, detect duplicate events by memorizing a timestamp for the most recent known event
 * 2.16 better output (clearer wording), better detection of pure deploys, don't create player-tracker-event for pure deploy (is already noticed by tracker)
 * 2.15 dont track events when a mod is removed, as this can either be destruction (by unknown attacker) or removal (by owner)
 * 2.14 Feed Events to all chat, enabling player tracker to see results
 * 2.13 Detect Mod Changes, use data.mtime, nicer output
 * 2.12 Overwrite Idledetection 
 * 2.11 Flip detection clientside
 * 2.1  Implement first try for catching flips
 * 2.0  Major rework for hook beforePortalReRender
 * 1.11 no team filtering clientside
 * 1.08 show box for guarded area, make box configurable (thereoretically, as server drops other requests) 
 * 1.07 FIX: http alive again, deactivated desktop notification
 * 1.05 remove debug log, sending coordinate dependent information
 * 1.04 bugfix
 * 
**/
function wrapper() {
    // ensure plugin framework is there, even if iitc is not yet loaded
    if(typeof window.plugin !== 'function') window.plugin = function() {};
    
    
    // PLUGIN START ////////////////////////////////////////////////////////
    
    // use own namespace for plugin
	var portalWarner =
	window.plugin.portalWarner =
		q.extend(function(){}, {
			api_version: 1,
			portals: [],
			// instead of coords multiplied with 1E6 where trailing zeros matter and may lead to confusion
			box_top: 49.175868,
			box_bottom: 48.832457,
			box_left: 11.631775,
			box_right: 12.355371,
			criticalLevel: 7,
			// set to true to watch portals anywhere, false to restrict to the box. Can be used as a quick switch
			ignoreBox: true,
			lastEvent: {}
		});
    
    
    portalWarner.getChanges = function (data, portalChangedTeam){
        var oldPortal = data.oldPortal,
        	newPortal = data.portal,
        	oldLevel = getPortalLevel(oldPortal),
        	newLevel = getPortalLevel(newPortal),
        	portalTitle = newPortal.portalV2.descriptiveText.TITLE,
        	portalAddress = newPortal.portalV2.descriptiveText.ADDRESS
        	oldResos = oldPortal.resonatorArray.resonators, 
        	newResos = newPortal.resonatorArray.resonators,
        	oldMods = oldPortal.portalV2.linkedModArray,
        	newMods = newPortal.portalV2.linkedModArray,
        	new_resos = [],
        	new_mods = [],
        	resoOwners = [],
        	players = {},
        	output = '',
        	flatOutput = '',
        	r8_count = 0,
        	changeIsOnlyDeploy = true,
        	changeIsOnlyUpgrade = true,
        	newModString = '',
        	mod = {},
        	upgradedResosdic = {},
        	modsdic = {},
        	actionstring = '',
        	detailedResos = [],
			user,
			message,
			result;
        
        if (portalTitle === undefined){
            console.log("portal title undefined", newPortal);
            portalTitle = "[unknown Portal]";
        }
        if (portalAddress === undefined){
            console.log("portal address undefined", newPortal);
            portalAddress = "[unknown Address]";
        }
        
        $.each(oldResos, function(key, value){
            if (value !== newResos[key]){
                if (value == null){
                    // Deployment
                    //console.log("Resonator was deployed in empty slot");
                    value = {}; // []
                    value['level'] = 0;
                } 
                if (newResos[key] == null) return true;
                
                // check level to filter out recharged resonators.
                if (newResos[key]['level'] > value['level'] || newResos[key]['ownerGuid'] != value['ownerGuid']) {
                    if (value["level"] == 0){ // empty slot
                        changeIsOnlyUpgrade = false;  // deploy took place
                    } else {
                        if (!portalChangedTeam){ // portal did not change team and old resonator is not null and new resonator is not null and different => an upgrade
							changeIsOnlyDeploy = false;
                            detailedResos.push(value["level"] + "->" + newResos[key]["level"]);
                        } 
                    }
                    new_resos.push(newResos[key]['level']);
                    if (newResos[key]['ownerGuid'] in upgradedResosdic){
                        upgradedResosdic[newResos[key]['ownerGuid']].push(newResos[key]['level']);
                    } else {
                        upgradedResosdic[newResos[key]['ownerGuid']] = [newResos[key]['level']];
                    }
                    //console.log(upgradedResosdic);
                    
                    if(parseInt(newResos[key]['level']) == 8) {
                        r8_count++;
                    }
                    // TODO: Wait for unresolved names to become available
                    if( $.inArray(window.getPlayerName(newResos[key]['ownerGuid']),resoOwners) == -1) {
                        resoOwners.push(window.getPlayerName(newResos[key]['ownerGuid']));
                        players[newResos[key]['ownerGuid']] = window.getPlayerName(newResos[key]['ownerGuid']);
                    }
                }
            }  
        });    // End of each
        if (portalChangedTeam === true) {
            actionstring = "captured and deployed ";
            //console.log("Captured and deployed", change_is_only_deploy, changeIsOnlyUpgrade, upgradedResosdic, resoOwners);
        } else {             
            if (change_is_only_deploy === true && changeIsOnlyUpgrade === false){
                actionstring += "deployed ";
            } else if (change_is_only_deploy === false && changeIsOnlyUpgrade===true) {
                actionstring += "upgraded with ";
            } else {
                actionstring += "deployed / upgraded with ";
            }
        }

        for (var playerGuid in upgradedResosdic) {
            if (upgradedResosdic.hasOwnProperty(playerGuid)) {
                if (change_is_only_deploy && newPortal.captured.capturingPlayerId === playerGuid) {
                    //console.log("Not generating event for player " + window.getPlayerName(playerGuid) + " as he already captured the portal");
                    continue;
                }
                user = window.getPlayerName(playerGuid);
                message = '{"gameBasket": {"deletedEntityGuids": [], "gameEntities": [], "inventory": []}, "result":';
                result =  '[["';
                result += playerGuid;
                result += '", ';
                result += data.mtime;
                result += ', {"plext": {"text": "';
                result += user;
                result += ' ' + actionstring;
                result += upgradedResosdic[playerGuid].sort().join(" ");
                result += ' Resonator(s) on ';
                result += portalTitle.replace(/(["])/g, "\\$1");
                result += ' (';
                result += portalAddress.replace(/(["])/g, "\\$1");
                result += ')", "markup": [["PLAYER", {"plain": "';
                result += user;
                result += '", "guid": "';
                result += playerGuid;
                result += '", "team": "';
                result += window.getTeam(newPortal) === 1  ? "RESISTANCE" : "ENLIGHTENED";
                result += '"}], ["TEXT", {"plain": " ' + actionstring + '"}], ["TEXT", {"plain": "L ';
                result += upgradedResosdic[playerGuid].sort().join(" ");
                result += '"}], ["TEXT", {"plain": " Resonator(s) on "}], ["PORTAL", {"name": "';
                result += portalTitle.replace(/(["])/g, "\\$1");
                result += '", "plain": "';
                result += portalTitle.replace(/(["])/g, "\\$1");
                result += ' (';
                result += portalAddress.replace(/(["])/g, "\\$1");
                result += ')", "team": "';
                result += window.getTeam(newPortal) === 1  ? "RESISTANCE" : "ENLIGHTENED";
                result += '", "latE6": ';
                result += newPortal.locationE6.latE6;
                result += ', "address": "';
                result += portalAddress.replace(/(["])/g, "\\$1");
                result += '", "lngE6": ';
                result += newPortal.locationE6.lngE6;
                result += ', "guid": "';
                result += data.portalGuid;
                result += '"}]], "plextType": "SYSTEM_BROADCAST", "team": "';
                result += window.getTeam(newPortal) === 1  ? "RESISTANCE" : "ENLIGHTENED";
                result += '"}}]]';
                
                message += result;
                message += '}';
                //console.log("PT Event: Reso upgrade: L" + newResos[key]['level'] + " Team: " + (window.getTeam(newPortal) === 1  ? "RESISTANCE" : "ENLIGHTENED") + " User: " + user + "@" + newPortal.portalV2.descriptiveText.TITLE);
                //console.log(message);
                window.chat.handlePublic(JSON.parse(message), 'success', '');                   
            }
        }
        
        $.each(oldMods, function(key, value){
            if (value !== newMods[key]){ // sometimes this "if" is true for unchanged mods
				// nothing changed (was already null) or mod has been removed or destroyed. As removal and destruction cannot be distinguished, we skip those events.
                if (newMods[key] === null) return true;
                if (value === null){
                    // Deployment
                    //console.log("Mod was deployed in empty slot");
                    value = {};
                }
                if (newMods[key] !== null && newMods[key].type===value.type && newMods[key].rarity === value.rarity){
                    console.log("Skipping mod, value=" + value + " newMods[key]=" + newMods[key] + " ==:" + value==newMods[key] );
                    return true;
                }
                mod = newMods[key];
                
                if (mod.installingUser in modsdic){
                    modsdic[mod.installingUser].push(mod.displayName+"("+mod.rarity[0]+")");
                } else {
                    modsdic[mod.installingUser] = [mod.displayName+"("+mod.rarity[0]+")"];
                }
                
                switch (mod.displayName) {
                    case 'Portal Shield':
                        newModString += 'S';		
                        break;
                    case 'Force Amp':
                        newModString += 'FA';		
                        break;
                    case 'Link Amp':
                        newModString += 'LA';		
                        break;  
                    case 'Heat Sink':
                        newModString += 'H';		
                        break;
                    case 'Multi-hack':
                        newModString += 'M';		
                        break;  
                    case 'Turret':
                        newModString += 'T';		
                        break;  
                    default:
                        newModString += '?';		
                        break;  
                }
                newModString += "(" + mod.rarity[0] + ") ";
                
                // TODO: Wait for unresolved names to become available
                if( $.inArray(window.getPlayerName(mod.installingUser),resoOwners) == -1){
                    resoOwners.push(window.getPlayerName(mod.installingUser)); // using resoOwners as we only want to see each name once.
                    players[mod.installingUser] = window.getPlayerName(mod.installingUser);
                }
                
            }  
        });    // End of each

        for (var playerGuid in modsdic) {
            if (modsdic.hasOwnProperty(playerGuid)) {
                //console.log("from modsdic: " + playerGuid + ": " + modsdic[playerGuid].sort().join(" "));
                user = window.getPlayerName(playerGuid);
                message = '{"gameBasket": {"deletedEntityGuids": [], "gameEntities": [], "inventory": []}, "result":';
                result =  '[["';
                result += playerGuid;
                result += '", ';
                result += data.mtime;
                result += ', {"plext": {"text": "';
                result += user;
                result += ' deployed Mods ';
                result += modsdic[playerGuid].sort().join(" ");
                result += ' on ';
                result += portalTitle.replace(/(["])/g, "\\$1");
                result += ' (';
                result += portalAddress.replace(/(["])/g, "\\$1");
                result += ')", "markup": [["PLAYER", {"plain": "';
                result += user;
                result += '", "guid": "';
                result += playerGuid;
                result += '", "team": "';
                result += window.getTeam(newPortal) === 1  ? "RESISTANCE" : "ENLIGHTENED";
                result += '"}], ["TEXT", {"plain": " deployed Mods "}], ["TEXT", {"plain": "';
                result += modsdic[playerGuid].sort().join(" ");
                result += '"}], ["TEXT", {"plain": " on "}], ["PORTAL", {"name": "';
                result += portalTitle.replace(/(["])/g, "\\$1");
                result += '", "plain": "';
                result += portalTitle.replace(/(["])/g, "\\$1");
                result += ' (';
                result += portalAddress.replace(/(["])/g, "\\$1");
                result += ')", "team": "';
                result += window.getTeam(newPortal) === 1  ? "RESISTANCE" : "ENLIGHTENED";
                result += '", "latE6": ';
                result += newPortal.locationE6.latE6;
                result += ', "address": "';
                result += portalAddress.replace(/(["])/g, "\\$1");
                result += '", "lngE6": ';
                result += newPortal.locationE6.lngE6;
                result += ', "guid": "';
                result += data.portalGuid;
                result += '"}]], "plextType": "SYSTEM_BROADCAST", "team": "';
                result += window.getTeam(newPortal) === 1  ? "RESISTANCE" : "ENLIGHTENED";
                result += '"}}]]';
                
                message += result;
                message += '}';
                //console.log("PT Event: Reso upgrade: L" + newResos[key]['level'] + " Team: " + (window.getTeam(newPortal) === 1  ? "RESISTANCE" : "ENLIGHTENED") + " User: " + user + "@" + newPortal.portalV2.descriptiveText.TITLE);
                //console.log(message);
                window.chat.handlePublic(JSON.parse(message), 'success', '');
            }
        }
        flatOutput = oldLevel.toFixed(3) + ' -> ' + newLevel.toFixed(3) + " " + portalTitle + ": ";
        
        if (new_resos.length > 0 || newModString !== "") {
            if (new_resos.length > 0) {
                output += actionstring;
                output += "resos = ";
                $.each(new_resos.sort(), function(key,value){
                    output += value+" ";
                });
                flatOutput += actionstring;
                flatOutput += "resos = ";
                $.each(new_resos.sort(), function(key,value){
                    flatOutput += value+" "
                    ;});
                if (detailedResos.length > 0){
                    flatOutput += "(" + detailedResos.join(" ") + ") ";
                }
            }
            if (newModString !== "") {
                output += "new mods = " + newModString;
                flatOutput += "new mods = " + newModString;
            }
            output += 'by CLASS_OF_TEAM';
            flatOutput += "by ";
            
            if(resoOwners.length == 1 && r8_count > 1){
                resoOwners.push("(Flipped)");
            }
            
            $.each(resoOwners, function(key,value){
                output += value+" ";
                flatOutput += value+" ";
            });
            console.log(flatOutput);
            
            return output;
        }   
        return "";
    };
    
    portalWarner.beforePortalReRender = function(data) {
        if(data.oldPortal == undefined ||
				data.portal == undefined ||
		   		window.portals[data.portalGuid] == undefined) {
            // console.log("Something was undefined", data.oldPortal, data.portal, window.portals[data.portalGuid]);
            return true;
        }
        var newPortal = data.portal,
			newLoc = newPortal.locationE6,
			k;

        if(portalWarner.ignoreBox || (
				newLoc.latE6 <= portalWarner.box_top*1E6 &&
				newLoc.latE6 >= portalWarner.box_bottom*1E6 &&
				newLoc.lngE6 <= portalWarner.box_right*1E6 &&
				newLoc.lngE6 >= portalWarner.box_left*1E6)) {
            var oldPortal = data.oldPortal;
            var p_guid = data.portalGuid;
            if (data.mtime == undefined) {
                var p_ts = window.portals[data.portalGuid].options.ent[1];
                console.log("data.mtime is undefined, we use " + p_ts + " which is " + unixTimeToString(p_ts, true) + " from window.portals[data.portalGuid].options.ent[1]");
            } else {
                var p_ts = data.mtime;
            }
            
            var p_tsHHmm = unixTimeToHHmm(p_ts, true);
            var p_tsString = unixTimeToString(p_ts, true);
            var oldResos = oldPortal.resonatorArray.resonators; 
            var newResos = newPortal.resonatorArray.resonators; 
            var p_name = newPortal.portalV2.descriptiveText.TITLE;
            var p_address = newPortal.portalV2.descriptiveText.ADDRESS; 
            var teams = ['none','Resistance','Enlightened'];
            var resochange = portalWarner.getChanges(data, getTeam(newPortal) != getTeam(oldPortal));           
            if (resochange === "") {
                return true; // Exit if no changes are found
            }
            if (p_name === undefined){
                p_name = "[unknown Portal]";
            }
            if (p_address === undefined){
                p_adress = "[unknown Address]";
            }
            if (portalWarner.lastEvent.hasOwnProperty(p_guid) && p_ts <= portalWarner.lastEvent[p_guid]){
                console.log("duplicate event, skipping");
                return true;
            }
            
            portalWarner.lastEvent[p_guid] = p_ts;
            var oldLevel = getPortalLevel(oldPortal);
            var newLevel = getPortalLevel(newPortal);
            
            var latlng = [newPortal.locationE6.latE6/1E6, newPortal.locationE6.lngE6/1E6];
            var ll = latlng[0]+","+latlng[1];
            var perma = 'https://ingress.com/intel?ll='+ll+'&pll='+ll+'&pguid='+p_guid+'&z=18';
            var js = 'window.zoomToAndShowPortal(\''+p_guid+'\', ['+latlng[0]+', '+latlng[1]+']);return false';
            var p_href = '<a onclick="'+js+'"'
            + ' title="'+ p_address+ '"'
            + ' href="'+ perma + '" class="help">'
            + p_name + '</a>';
            
            var p_msg = oldLevel.toFixed(3) + ' -> ' + newLevel.toFixed(3);
            
            if (newLevel >= portalWarner.criticalLevel) {
                if (getTeam(newPortal) == 1) {
                    severity = 'font-weight: bold; color: red;';
                } else { 
                    severity = 'font-weight: bold; color: green;';
                }
            } else {
                severity = '';
            }
            
            var t = '<time title="'+p_tsString+'" data-timestamp="'+p_ts+'">'+p_tsHHmm+'</time>';
            var markup = '<tr style="'+severity+'"><td>'+t+'</td><td>'+p_msg+'</td><td>'+p_href+' '+resochange+'</td></tr>';
            $('#chatportals > table').append(markup.replace(/CLASS_OF_TEAM/g,'<span class="'+TEAM_TO_CSS[getTeam(newPortal)]+'">')+"</span>");
            $('#chatportals').scrollTop(99999999);
            
            
            
        } 
    };
    portalWarner.chooser = function(event) {
        var t = $(event.target);
        var tt = t.text();
        
        $('#chatcontrols .active').removeClass('active');
        t.addClass('active');
        
        $('#chat > div').hide();  
        var elm = $('#chat' + tt);
        elm.show();
        
    };
    
    portalWarner.setup = function() {
        window.addHook('beforePortalReRender', portalWarner.beforePortalReRender);
        $('#chatcontrols').append('<a id="hrefchatportals">portals</a>');
        $('#chat').append('<div id="chatportals"><table></table></div>');
        $('#hrefchatportals').click(portalWarner.chooser);
        // Try to overwrite iitc config for idle timeout
        window.MAX_IDLE_TIME = 6000;
        // No Idle
        window.isIdle = function(){
            return false;
        }
        //reload after 24 hours
        setTimeout('location.reload();', 24*3600*1000);  
        // more refresh
        window.REFRESH = 30;
        window.ZOOM_LEVEL_ADJ = 3;
        if (!portalWarner.ignoreBox){
            var polygon = L.polygon([
                [portalWarner.box_top, portalWarner.box_left],
                [portalWarner.box_top, portalWarner.box_right],
                [portalWarner.box_bottom, portalWarner.box_right],
                [portalWarner.box_bottom, portalWarner.box_left]
            ],{fill: false, color: 'red', weight: 3}).addTo(window.map);
        }
        
        console.log("PLUGIN: Portal warner loaded");
        
    };
    
    var setup =   portalWarner.setup;
    
    
    // PLUGIN END //////////////////////////////////////////////////////////
    if(window.iitcLoaded && typeof setup === 'function') {
        setup();
    } else {
        if(window.bootPlugins)
            window.bootPlugins.push(setup);
        else
            window.bootPlugins = [setup];
    }
} // wrapper end
// inject code into site context
var script = document.createElement('script');
script.appendChild(document.createTextNode('('+ wrapper +')();'));
(document.body || document.head || document.documentElement).appendChild(script);
