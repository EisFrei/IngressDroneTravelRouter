// ==UserScript==
// @id dronePathTravelPlanner
// @name IITC Plugin: Drone Travel Router
// @category Tweaks
// @version 0.0.1
// @namespace	https://github.com/EisFrei/IngressDroneTravelRouter
// @downloadURL	https://github.com/EisFrei/IngressDroneTravelRouter/raw/master/dronePathTravelRouter.user.js
// @homepageURL	https://github.com/EisFrei/IngressDroneTravelRouter
// @description Calculates a possible path
// @author EisFrei
// @include		https://intel.ingress.com/*
// @match		https://intel.ingress.com/*
// @grant			none
// ==/UserScript==

/* globals dialog */

// Wrapper function that will be stringified and injected
// into the document. Because of this, normal closure rules
// do not apply here.
function wrapper(plugin_info) {
	// Make sure that window.plugin exists. IITC defines it as a no-op function,
	// and other plugins assume the same.
	if (typeof window.plugin !== "function") window.plugin = function () {};

	const KEY_SETTINGS = "plugin-drone-path-travel-router-settings";
	const KEY_ROUTES = "plugin-drone-path-travel-router-routes"

	// Use own namespace for plugin
	window.plugin.DronePathTravelRouter = function () {};

	const thisPlugin = window.plugin.DronePathTravelRouter;

    let startPortal = null;
    let targetPortal = null;

	// Name of the IITC build for first-party plugins
	plugin_info.buildName = "DronePathTravelRouter";

	// Datetime-derived version of the plugin
	plugin_info.dateTimeVersion = "202012192331";

	// ID/name of the plugin
	plugin_info.pluginId = "dronepathtravelrouter";

	function haversine(lat1, lon1, lat2, lon2) {
		const R = 6371e3; // metres
		const φ1 = lat1 * Math.PI/180; // φ, λ in radians
		const φ2 = lat2 * Math.PI/180;
		const Δφ = (lat2-lat1) * Math.PI/180;
		const Δλ = (lon2-lon1) * Math.PI/180;

		const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
					Math.cos(φ1) * Math.cos(φ2) *
					Math.sin(Δλ/2) * Math.sin(Δλ/2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

		return R * c; // in metres
	}

    thisPlugin.setStartPortal = function() {
        startPortal = window.selectedPortal;
        calcRoute();
    };

    thisPlugin.setTargetPortal = function() {
        targetPortal = window.selectedPortal;
        calcRoute();
    };

    const travelDistance = 500;

    function portalsInRange(portal) {
        const viable = [];

        for (let guid in allPortals) {
            const cur = allPortals[guid];
            const distance = haversine(portal._latlng.lat, portal._latlng.lng, cur._latlng.lat, cur._latlng.lng);
            if (distance < travelDistance && visited.indexOf(cur) === -1) {
                viable.push(cur);
            }
        }

        return viable;
    }

    function sortByDistanceToTarget(portals, target) {
        const pd = portals.map((p) => {
            return {
                portal: p,
                distance: haversine(p._latlng.lat, p._latlng.lng, target._latlng.lat, target._latlng.lng)
            }
        });
        pd.sort((a, b) => a.distance - b.distance);
        return pd.map((p) => p.portal);
    }

    function recurseRoute(position, target, route) {
        if (route.indexOf(position) !== -1) {
            return position;
        }

        route.push(position);
        visited.push(position);
        if (position === target) {
            return route;
        }
        const viable = sortByDistanceToTarget(portalsInRange(position), target);
        for (let i = 0; i < viable.length; i++) {
            const p = viable[i];
            const res = recurseRoute(p, target, route.slice());
            if (res) {
                return res;
            }
        }
        return false;
    }

    let visited = [];

    function calcRoute() {
        if (!startPortal || !targetPortal) {
           return;
        }
        const p1 = allPortals[startPortal];
        const p2 = allPortals[targetPortal];
        visited = [p1];
        const route = recurseRoute(p1, p2, []);
        if (route) {
            console.log('route', route);
            var poly = L.polyline(route.map(r => r._latlng), {
                color: '#FF0000',
                opacity: 1,
                weight: 1.5,
                interactive: false,
                smoothFactor: 10,
                dashArray: '6, 4',
            });
            thisPlugin.layerGroup.clearLayers();
            poly.addTo(thisPlugin.layerGroup);
        }
    }

    thisPlugin.addToPortalDetails = function () {
		const portalDetails = document.getElementById('portaldetails');

		if (window.selectedPortal == null) {
			return;
		}

		if (!thisPlugin.onPortalSelectedPending) {
			thisPlugin.onPortalSelectedPending = true;

			setTimeout(function () {
				thisPlugin.onPortalSelectedPending = false;

				$(portalDetails).append(`<div id="droneButtons" class="DroneButtons">Drone Route: <a class="droneRoutebutton" onclick="window.plugin.DronePathTravelRouter.setStartPortal();return false;" title="Set this portal as start portal for the route"><span>Start</span></a> -- <a class="droneRoutebutton" onclick="window.plugin.DronePathTravelRouter.setTargetPortal();return false;" title="Set this portal as target portal for the route"><span>End</span></a></div>`);
				//thisPlugin.updateStarPortal();
			}, 0);
		}
	}

    const allPortals = {};

    thisPlugin.addToPortalMap = function (data) {
        allPortals[data.portal.options.guid] = data.portal;
    }



	function setup() {
        thisPlugin.layerGroup = new L.LayerGroup();
        window.addLayerGroup('Drone Route', thisPlugin.layerGroup, false);

        window.addHook('portalSelected', thisPlugin.addToPortalDetails);
        window.addHook('portalAdded', thisPlugin.addToPortalMap);
    }
    	setup.info = plugin_info; //add the script info data to the function as a property
	// if IITC has already booted, immediately run the 'setup' function
	if (window.iitcLoaded) {
		setup();
		} else {
			if (!window.bootPlugins) {
				window.bootPlugins = [];
			}
		window.bootPlugins.push(setup);
	}
}



(function () {
	const plugin_info = {};
	if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) {
		plugin_info.script = {
			version: GM_info.script.version,
			name: GM_info.script.name,
			description: GM_info.script.description
		};
	}
	// Greasemonkey. It will be quite hard to debug
	if (typeof unsafeWindow != 'undefined' || typeof GM_info == 'undefined' || GM_info.scriptHandler != 'Tampermonkey') {
	// inject code into site context
		const script = document.createElement('script');
		script.appendChild(document.createTextNode('(' + wrapper + ')(' + JSON.stringify(plugin_info) + ');'));
		(document.body || document.head || document.documentElement).appendChild(script);
	} else {
		// Tampermonkey, run code directly
		wrapper(plugin_info);
	}
})();
