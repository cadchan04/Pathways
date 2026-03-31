const flightService = require("./flight-services");
const trainService = require("./train-service");
const busService = require("./bus-service");
const drivingService = require("./driving-service");
const axios = require("axios");

function primaryCity(value) {
    return String(value || "").split(",")[0].trim().toLowerCase();
}

function roundCoord(value, places = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * (10 ** places)) / (10 ** places);
}

function coordKey(coords) {
    const lat = roundCoord(coords?.lat, 2);
    const lng = roundCoord(coords?.lng, 2);
    if (lat == null || lng == null) return null;
    return `${lat},${lng}`;
}

function haversine(a, b) {
    if (!a?.lat || !b?.lat) return 9999;
    const R = 3958.8;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lng - a.lng) * Math.PI / 180;
    const aVal = Math.sin(dLat / 2) ** 2 +
        Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}

function getHubKey(loc) {
    if (!loc) return "";
    const s = (loc.address || loc.name || "").toString().trim();
    return primaryCity(s) || s.toLowerCase();
}

function locationKey(loc) {
    if (!loc) return "";
    const addr = (loc.address || loc.name || "").toLowerCase().trim();
    if (addr) return addr;
    if (loc.coordinates?.lat && loc.coordinates?.lng)
        return `${loc.coordinates.lat.toFixed(3)},${loc.coordinates.lng.toFixed(3)}`;
    return JSON.stringify(loc);
}

function isSameLocation(locA, locB) {
    if (!locA || !locB) return false;
    const addrA = (locA.address || locA.name || "").toLowerCase().trim();
    const addrB = (locB.address || locB.name || "").toLowerCase().trim();
    if (addrA !== "" && (addrA === addrB || addrA.includes(addrB) || addrB.includes(addrA))) return true;
    const hubA = getHubKey(locA);
    const hubB = getHubKey(locB);
    if (hubA && hubB && (hubA === hubB || hubA.includes(hubB) || hubB.includes(hubA))) return true;
    if (locA.coordinates && locB.coordinates)
        return haversine(locA.coordinates, locB.coordinates) < PROXIMITY_SNAP_MILES;
    return false;
}

function isSamePlaceByName(locA, locB) {
    const nameA = (locA?.name ?? "").toString().trim().toLowerCase();
    const nameB = (locB?.name ?? "").toString().trim().toLowerCase();
    return nameA !== "" && nameA === nameB;
}

// ===== Constants =====

const MAX_LEGS = 5;
const MAX_LAYOVER_MS = 6 * 60 * 60 * 1000;
const PROXIMITY_SNAP_MILES = 3.5;
const ORIGIN_DEST_RADIUS_MILES = 75;
const MAX_DRIVING_MINUTES = 4 * 60;
const MIN_BUFFER_BEFORE_FLIGHT_MINUTES = 90;

const FETCH_HUB_NAMES = ["Atlanta", "Chicago", "Dallas", "Denver", "Los Angeles", "Newark"];

const US_HUBS = [
    { name: "Atlanta",       coordinates: { lat: 33.6407, lng: -84.4277  }, address: "Atlanta, GA"       },
    { name: "Boston",        coordinates: { lat: 42.3656, lng: -71.0096  }, address: "Boston, MA"        },
    { name: "Charlotte",     coordinates: { lat: 35.2144, lng: -80.9473  }, address: "Charlotte, NC"     },
    { name: "Chicago",       coordinates: { lat: 41.9742, lng: -87.9073  }, address: "Chicago, IL"       },
    { name: "Dallas",        coordinates: { lat: 32.8968, lng: -97.038   }, address: "Dallas, TX"        },
    { name: "Denver",        coordinates: { lat: 39.8617, lng: -104.6731 }, address: "Denver, CO"        },
    { name: "Detroit",       coordinates: { lat: 42.2124, lng: -83.3534  }, address: "Detroit, MI"       },
    { name: "Houston",       coordinates: { lat: 29.9902, lng: -95.3368  }, address: "Houston, TX"       },
    { name: "Indianapolis",  coordinates: { lat: 39.7684, lng: -86.1581  }, address: "Indianapolis, IN"  },
    { name: "Las Vegas",     coordinates: { lat: 36.084,  lng: -115.1537 }, address: "Las Vegas, NV"     },
    { name: "Los Angeles",   coordinates: { lat: 33.9425, lng: -118.4081 }, address: "Los Angeles, CA"   },
    { name: "Miami",         coordinates: { lat: 25.7959, lng: -80.287   }, address: "Miami, FL"         },
    { name: "Minneapolis",   coordinates: { lat: 44.882,  lng: -93.2218  }, address: "Minneapolis, MN"   },
    { name: "Newark",        coordinates: { lat: 40.6895, lng: -74.1745  }, address: "Newark, NJ"        },
    { name: "Orlando",       coordinates: { lat: 28.4312, lng: -81.3081  }, address: "Orlando, FL"       },
    { name: "Phoenix",       coordinates: { lat: 33.4341, lng: -112.008  }, address: "Phoenix, AZ"       },
    { name: "San Francisco", coordinates: { lat: 37.6213, lng: -122.379  }, address: "San Francisco, CA" },
    { name: "Seattle",       coordinates: { lat: 47.4502, lng: -122.3088 }, address: "Seattle, WA"       },
    { name: "Washington",    coordinates: { lat: 38.8512, lng: -77.0402  }, address: "Washington, DC"    },
];

const TRANSFER_BUFFER_MINUTES = {
    "Flight->Train":     60,
    "Flight->Bus":       60,
    "Train->Train":      30,
    "Train->Bus":        30,
    "Train->Flight":     MIN_BUFFER_BEFORE_FLIGHT_MINUTES,
    "Bus->Train":        30,
    "Bus->Bus":          30,
    "Bus->Flight":       MIN_BUFFER_BEFORE_FLIGHT_MINUTES,
    "Driving->Flight":   Math.max(45, MIN_BUFFER_BEFORE_FLIGHT_MINUTES),
    "Driving->Train":    45,
    "Driving->Bus":      45,
    "Rideshare->Flight": Math.max(45, MIN_BUFFER_BEFORE_FLIGHT_MINUTES),
    "Rideshare->Train":  45,
    "Rideshare->Bus":    45,
};

function getTransferBufferMs(prevMode, nextMode) {
    if (!prevMode || !nextMode) return 0;
    const key = `${prevMode}->${nextMode}`;
    let minutes = TRANSFER_BUFFER_MINUTES[key] ?? 30;
    if (nextMode === "Flight" && prevMode !== "Flight")
        minutes = Math.max(minutes, MIN_BUFFER_BEFORE_FLIGHT_MINUTES);
    return minutes * 60 * 1000;
}

async function fetchLegPool(from, to, date) {
    try {
        const [f, t, b] = await Promise.allSettled([
            flightService.searchFlightsCity(from, to, date),
            trainService.getTrainRoutes({ originName: from, destinationName: to, departDate: date }),
            busService.getBusRoutes({ originName: from, destinationName: to, departDate: date }),
        ]);
        return [
            ...((f.status === "fulfilled" ? f.value : []) || []).flatMap(x => x.legs || []),
            ...((t.status === "fulfilled" ? t.value : []) || []).flatMap(x => x.legs || []),
            ...((b.status === "fulfilled" ? b.value : []) || []).flatMap(x => x.legs || []),
        ];
    } catch { return []; }
}

async function getDirectDrivingRoute(origin, destination, date, mpg) {
    const dateStr = typeof date === "string" ? date.split("T")[0] : new Date(date).toISOString().split("T")[0];
    try {
        const routes = await drivingService.getDrivingRoutes({
            originName: origin?.name || origin?.address,
            destinationName: destination?.name || destination?.address,
            departDate: dateStr, mpg,
        });
        const r = routes[0];
        if (!r?.legs?.length) return null;
        const first = r.legs[0], last = r.legs[r.legs.length - 1];
        return {
            origin: r.origin || first.origin, destination: r.destination || last.destination,
            legs: r.legs, totalCost: r.totalCost || 0, totalDuration: r.totalDuration || 0,
            totalDistance: r.totalDistance || 0, departAt: first.departAt, arriveAt: last.arriveAt,
            modeSequence: "Driving", signature: `Driving-${first.departAt}-${last.arriveAt}`,
        };
    } catch { return null; }
}

function fallbackDrivingLeg(point, hub, type, date, dist) {
    const dur = Math.min(MAX_DRIVING_MINUTES, Math.round(dist / 0.7) + 20);
    return {
        transportationMode: "Driving", provider: "Personal Vehicle",
        origin:      type === "origin" ? point : hub,
        destination: type === "origin" ? hub   : point,
        departAt: new Date(date).toISOString(),
        arriveAt: new Date(new Date(date).getTime() + dur * 60000).toISOString(),
        duration: dur, cost: Math.round(dist * 0.6), distance: dist,
    };
}

function fetchDrivingEdgeForHub(point, hub, type, date, mpg, dist) {
    return drivingService.getDrivingRoutes({
        originName:      type === "origin" ? point.name : hub.name,
        destinationName: type === "origin" ? hub.name   : point.name,
        departDate: date, mpg,
    }).then(routes => {
        const legs = (routes[0]?.legs || []).filter(l => (l.duration || 0) <= MAX_DRIVING_MINUTES);
        return legs.length > 0 ? legs : [fallbackDrivingLeg(point, hub, type, date, dist)];
    }).catch(() => [fallbackDrivingLeg(point, hub, type, date, dist)]);
}

function getNearbyHubTargets(point, hubs) {
    const maxDist = (MAX_DRIVING_MINUTES - 20) * 0.7;
    return hubs
        .map(h => ({ hub: h, dist: haversine(point.coordinates, h.coordinates) }))
        .filter(item => item.dist <= maxDist)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 10);
}

function extractHubsByAddress(legs) {
    const hubs = {};
    for (const leg of legs) {
        for (const side of [leg.origin, leg.destination]) {
            if (!side) continue;
            const key = getHubKey(side) || side.address || side.name;
            if (key) hubs[key] = side;
        }
    }
    return Object.values(hubs);
}

function addMajorHubs(hubs) {
    const byName = new Set(hubs.map(h => (h?.name || "").toLowerCase()));
    for (const h of US_HUBS) {
        if (!h?.name || byName.has(h.name.toLowerCase())) continue;
        hubs.push(h);
        byName.add(h.name.toLowerCase());
    }
    return hubs;
}

function enrichLegPoolBackground(legs) {
    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey) return;
    const cache = new Map();
    const toFetch = [];
    const consider = (loc) => {
        const key = coordKey(loc?.coordinates);
        if (!key || cache.has(key)) return;
        cache.set(key, undefined);
        toFetch.push({ key, coords: loc.coordinates });
    };
    for (const leg of legs) { consider(leg?.origin); consider(leg?.destination); }
    let i = 0;
    const workers = Array.from({ length: Math.min(8, toFetch.length) }).map(async () => {
        while (i < toFetch.length) {
            const item = toFetch[i++];
            try {
                const r = await axios.get("https://api.geoapify.com/v1/geocode/reverse", {
                    params: { lat: item.coords.lat, lon: item.coords.lng, format: "json", limit: 1, apiKey },
                    timeout: 8000,
                });
                const res = r.data?.results?.[0];
                const city = res?.city || res?.town || res?.village || res?.suburb || res?.county || res?.state;
                const state = res?.state_code || res?.state;
                const country = res?.country_code?.toUpperCase() || res?.country;
                cache.set(item.key, city ? [city, state, country].filter(Boolean).join(", ") : null);
            } catch { cache.set(item.key, null); }
        }
    });
    Promise.all(workers).then(() => {
        for (const leg of legs) {
            for (const loc of [leg?.origin, leg?.destination]) {
                if (!loc) continue;
                const city = cache.get(coordKey(loc.coordinates));
                if (city) loc.address = city;
            }
        }
    }).catch(() => {});
}

function findPathsAStar(edges, origin, destination, date) {
    const startTime = new Date(date).getTime();
    let queue = [{
        currentLoc: origin, path: [], currentTime: startTime,
        totalCost: 0, totalDistance: 0,
        score: 0, distToGoal: haversine(origin.coordinates, destination.coordinates),
        visitedNodeKeys: new Set([locationKey(origin)]),
    }];

    const finalPaths = [];
    const bestArrivals = new Map();

    while (queue.length > 0 && finalPaths.length < 100) {
        queue.sort((a, b) => a.score - b.score);
        const state = queue.shift();

        if (isSameLocation(state.currentLoc, destination)) {
            finalPaths.push({ legs: state.path, totalCost: state.totalCost, totalDistance: state.totalDistance });
            continue;
        }

        const slot = Math.floor(new Date(state.currentTime).getHours() / 2);
        const nodeKey = `${state.currentLoc.address || state.currentLoc.name}-${slot}-${state.path[0]?.transportationMode || "Start"}`;
        if (bestArrivals.has(nodeKey) && state.currentTime > bestArrivals.get(nodeKey) + (90 * 60000)) continue;
        bestArrivals.set(nodeKey, state.currentTime);
        if (state.path.length >= MAX_LEGS) continue;

        const nextLegs = edges.filter(e => {
            if (!e.origin || !e.destination) return false;
            if (e.transportationMode === "Driving" && (e.duration || 0) > MAX_DRIVING_MINUTES) return false;
            return state.path.length === 0
                ? isSameLocation(e.origin, origin)
                : isSameLocation(e.origin, state.currentLoc);
        });

        for (const leg of nextLegs) {
            const depTime = new Date(leg.departAt).getTime();
            const arrTime = new Date(leg.arriveAt).getTime();
            if (Number.isNaN(depTime) || Number.isNaN(arrTime)) continue;
            const prevLeg = state.path[state.path.length - 1];
            const bufferMs = state.path.length === 0 ? 0 : getTransferBufferMs(prevLeg.transportationMode, leg.transportationMode);
            if (depTime < state.currentTime + bufferMs) continue;
            if (state.path.length > 0 && (depTime - state.currentTime) > MAX_LAYOVER_MS) continue;
            const destKey = locationKey(leg.destination);
            if (state.visitedNodeKeys.has(destKey)) continue;
            const newDist = haversine(leg.destination.coordinates, destination.coordinates);
            const nextVisited = new Set(state.visitedNodeKeys);
            nextVisited.add(destKey);
            queue.push({
                currentLoc: leg.destination,
                path: [...state.path, leg],
                currentTime: arrTime,
                totalCost: state.totalCost + (leg.cost || 0),
                totalDistance: state.totalDistance + (leg.distance || 0),
                score: (arrTime - startTime) + newDist * 4.5 * 60000 + state.path.length * 3 * 60 * 1000,
                distToGoal: newDist,
                visitedNodeKeys: nextVisited,
            });
        }
    }
    return finalPaths;
}

function computeRouteScore(route) {
    const cost = Number(route.totalCost) || 0;
    const duration = Number(route.totalDuration) || 0;
    const legs = route.legs || [];
    const inVehicleMinutes = legs.reduce((s, l) => s + (l.duration || 0), 0);
    const longLayoverHours = Math.max(0, (duration - inVehicleMinutes) - 90) / 60;
    return cost * 1.0 + duration * 0.7 + Math.max(0, legs.length - 1) * 20 + longLayoverHours * 15;
}

function formatAndRank(paths, origin, destination) {
    const mapped = paths.filter(res => res.legs?.length > 0).map(res => {
        const first = res.legs[0], last = res.legs[res.legs.length - 1];
        const modeSeq = res.legs.map(l => l.transportationMode).join("->");
        const departAt = first.departAt, arriveAt = last.arriveAt;
        const totalDurationMinutes = Math.round((new Date(arriveAt) - new Date(departAt)) / 60000);
        const totalDistance = res.totalDistance || res.legs.reduce((s, l) => s + (l.distance || 0), 0);
        const base = {
            origin, destination, legs: res.legs, totalCost: res.totalCost,
            totalDuration: totalDurationMinutes, totalDistance, departAt, arriveAt,
            modeSequence: modeSeq, signature: `${modeSeq}-${departAt}-${arriveAt}`,
        };
        return { ...base, score: computeRouteScore(base) };
    });

    const bySignature = new Map();
    for (const r of mapped) {
        const ex = bySignature.get(r.signature);
        if (!ex || r.score < ex.score) bySignature.set(r.signature, r);
    }

    const filtered = Array.from(bySignature.values())
        .filter(r => {
            if (!r.legs[0]?.origin || !r.legs[r.legs.length - 1]?.destination) return false;
            if (!origin?.coordinates || !destination?.coordinates) return true;
            return (
                haversine(origin.coordinates, r.legs[0].origin.coordinates) <= ORIGIN_DEST_RADIUS_MILES &&
                haversine(destination.coordinates, r.legs[r.legs.length - 1].destination.coordinates) <= ORIGIN_DEST_RADIUS_MILES
            );
        })
        .filter(r => !r.legs.some(l => l.transportationMode === "Driving" && (l.duration || 0) > MAX_DRIVING_MINUTES))
        .sort((a, b) => a.score - b.score);

    const byModeSeq = new Map();
    for (const r of filtered) {
        const list = byModeSeq.get(r.modeSequence) || [];
        if (list.length < 4) list.push(r);
        byModeSeq.set(r.modeSequence, list);
    }
    return Array.from(byModeSeq.values()).flat().sort((a, b) => a.score - b.score).slice(0, 50);
}

async function fillTransferGaps(routes, date, mpg) {
    return Promise.all(routes.map(async (route) => {
        const legs = route.legs || [];
        if (legs.length <= 1) return route;
        const MIN_RIDESHARE_DIST = 1;
        const gapLegs = await Promise.all(legs.slice(0, -1).map(async (prev, i) => {
            const next = legs[i + 1];
            if (isSamePlaceByName(prev.destination, next.origin)) return null;
            if (next.transportationMode === "Driving") return null;
            const dist = (prev.destination?.coordinates && next.origin?.coordinates)
                ? haversine(prev.destination.coordinates, next.origin.coordinates) : 0;
            if (dist < MIN_RIDESHARE_DIST) return null;
            const prevArrive = new Date(prev.arriveAt).getTime();
            try {
                const rs = await drivingService.getDrivingRoutes({
                    originName: (prev.destination?.name || prev.destination?.address || "").trim(),
                    destinationName: (next.origin?.name || next.origin?.address || "").trim(),
                    departDate: new Date(prevArrive).toISOString().split("T")[0], mpg,
                });
                const d = rs[0]?.legs?.[0];
                if (d && (d.duration || 0) <= MAX_DRIVING_MINUTES && (d.distance ?? dist) >= MIN_RIDESHARE_DIST) {
                    return {
                        transportationMode: "Rideshare", provider: "Rideshare",
                        origin: prev.destination, destination: next.origin,
                        departAt: new Date(prevArrive).toISOString(),
                        arriveAt: new Date(prevArrive + (d.duration || 0) * 60000).toISOString(),
                        duration: d.duration || 0, distance: d.distance ?? dist, cost: d.cost || 0,
                    };
                }
            } catch {}
            const dur = Math.min(MAX_DRIVING_MINUTES, Math.round(dist / 0.5) + 15);
            return {
                transportationMode: "Rideshare", provider: "Rideshare",
                origin: prev.destination, destination: next.origin,
                departAt: new Date(prevArrive).toISOString(),
                arriveAt: new Date(prevArrive + dur * 60000).toISOString(),
                duration: dur, distance: Math.round(dist * 10) / 10, cost: Math.round(dist * 0.5),
            };
        }));
        const newLegs = [];
        for (let i = 0; i < legs.length; i++) {
            newLegs.push(legs[i]);
            if (gapLegs[i]) newLegs.push(gapLegs[i]);
        }
        const first = newLegs[0], last = newLegs[newLegs.length - 1];
        return {
            ...route, legs: newLegs,
            totalDuration: Math.round((new Date(last.arriveAt) - new Date(first.departAt)) / 60000),
            totalDistance: newLegs.reduce((s, l) => s + (l.distance || 0), 0),
            totalCost:     newLegs.reduce((s, l) => s + (l.cost     || 0), 0),
            arriveAt: last.arriveAt,
            modeSequence: newLegs.map(l => l.transportationMode).join("->"),
        };
    }));
}

// Transit legs + direct driving all fire in parallel.
//          A* runs immediately when they land → fast partial results.
//
//  Driving edge fetches (up to ~20 calls) were already in-flight.
//  When they finish, A* re-runs with the full edge set and the final merged list is returned.

async function multiModalRoutes(origin, destination, date, mpg, onPartialResults) {
    console.log(`MPG:${mpg}`);
    if (primaryCity(origin?.name) === primaryCity(destination?.name)) return [];

    // Build transit query list
    const seenQueries = new Set();
    const transitTasks = [];
    const addQuery = (from, to) => {
        if (!from || !to) return;
        const key = `${from.toLowerCase()}|${to.toLowerCase()}`;
        if (primaryCity(from) === primaryCity(to) || seenQueries.has(key)) return;
        seenQueries.add(key);
        transitTasks.push(fetchLegPool(from, to, date));
    };
    addQuery(origin.name, destination.name);
    FETCH_HUB_NAMES.forEach(hub => { addQuery(origin.name, hub); addQuery(hub, destination.name); });

    // ── Wave 1 ── fire everything at once, don't wait between them
    const [transitResults, drivingOnly] = await Promise.all([
        Promise.allSettled(transitTasks),
        getDirectDrivingRoute(origin, destination, date, mpg),
    ]);

    const transitLegs = transitResults
        .filter(r => r.status === "fulfilled")
        .flatMap(r => r.value);

    enrichLegPoolBackground(transitLegs); // never blocks

    const hubs = addMajorHubs(extractHubsByAddress(transitLegs));

    // ── Wave 2 setup ── kick off ALL driving edge fetches now, before A* even starts
    const nearbyOriginTargets = getNearbyHubTargets(origin, hubs);
    const nearbyDestTargets   = getNearbyHubTargets(destination, hubs);
    const drivingEdgePromise  = Promise.all([
        ...nearbyOriginTargets.map(({ hub, dist }) => fetchDrivingEdgeForHub(origin,      hub, "origin",      date, mpg, dist)),
        ...nearbyDestTargets.map  (({ hub, dist }) => fetchDrivingEdgeForHub(destination, hub, "destination", date, mpg, dist)),
    ]);

    // ── Wave 1 results ── A* on transit-only edges (fast, no driving waits)
    const wave1Paths  = findPathsAStar(transitLegs, origin, destination, date);
    let   wave1Routes = formatAndRank(wave1Paths, origin, destination);
    wave1Routes       = await fillTransferGaps(wave1Routes, date, mpg);
    if (drivingOnly) wave1Routes = [drivingOnly, ...wave1Routes];

    // Emit to caller immediately — lets the UI start rendering
    if (typeof onPartialResults === "function") onPartialResults(wave1Routes);

    // ── Wave 2 results ── A* with full edge set once driving edges land
    const drivingEdgeSets = await drivingEdgePromise;
    const allEdges        = [...transitLegs, ...drivingEdgeSets.flat()];
    const wave2Paths      = findPathsAStar(allEdges, origin, destination, date);
    let   wave2Routes     = formatAndRank(wave2Paths, origin, destination);
    wave2Routes           = await fillTransferGaps(wave2Routes, date, mpg);
    if (drivingOnly) wave2Routes = [drivingOnly, ...wave2Routes];

    return wave2Routes;
}

async function regenerateRoute(route, legIndicies) {
    console.log("Regenerating route with new legs...", route.name, legIndicies);

    const gaps = [];
    let currentGap = [];
    const sortedIndices = [...legIndicies].sort((a, b) => a - b);

    // Group consecutive leg indices into gaps
    for (let i = 0; i < sortedIndices.length; i++) {
        currentGap.push(sortedIndices[i]);
        if (sortedIndices[i + 1] !== sortedIndices[i] + 1) {
            gaps.push(currentGap);
            currentGap = [];
        }
    }

    let regeneratedRoutes = [route];

    // For each gap, find replacements and create new routes
    for (const gap of gaps) {
        const startIndex = gap[0];
        const endIndex = gap[gap.length - 1] + 1;

        const origin = route.legs[startIndex].origin;
        const destination = route.legs[endIndex - 1].destination;
        const date = route.legs[startIndex].departAt;

        const replacements = await multiModalRoutes(origin, destination, date);
        if (replacements.length === 0) {
            console.log(`No replacements found for legs ${startIndex}-${endIndex - 1} (${origin.name} -> ${destination.name})`);
            continue;
        }

        let possibleRoutes = [];

        // For each possible route, replace the gap with each replacement and add to possibleRoutes
        for (const r of regeneratedRoutes) {
            for (const replacement of replacements) {
                const newLegs = [...r.legs];
                const newCost = (r.totalCost || 0) - (newLegs.slice(startIndex, endIndex).reduce((s, l) => s + (l.cost || 0), 0)) + (replacement.legs.reduce((s, l) => s + (l.cost || 0), 0));
                const newDuration = (r.totalDuration || 0) - (newLegs.slice(startIndex, endIndex).reduce((s, l) => s + (l.duration || 0), 0)) + (replacement.legs.reduce((s, l) => s + (l.duration || 0), 0));
                newLegs.splice(startIndex, endIndex - startIndex, ...replacement.legs);

                possibleRoutes.push({ ...r, totalCost: newCost, totalDuration: newDuration, updatedAt: new Date(), legs: newLegs });
            }
        }
        regeneratedRoutes = possibleRoutes
    }
    console.log(`Regeneration complete. Found ${regeneratedRoutes.length} possible routes after replacing legs ${legIndicies.join(", ")}.`);
    for (const r of regeneratedRoutes) {
        console.log("Regenerated route:", r.legs.map(l => `${l.transportationMode}(${l.origin?.name || l.origin?.address} -> ${l.destination?.name || l.destination?.address})`).join(" -> "));
    }
    return regeneratedRoutes;
}


module.exports = { multiModalRoutes, regenerateRoute };