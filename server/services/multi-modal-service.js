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
    const f = 10 ** places;
    return Math.round(n * f) / f;
}

function coordKey(coords) {
    const lat = roundCoord(coords?.lat, 2);
    const lng = roundCoord(coords?.lng, 2);
    if (lat == null || lng == null) return null;
    return `${lat},${lng}`;
}

async function reverseGeocodeCity(coords, apiKey) {
    if (!apiKey) return null;
    const lat = Number(coords?.lat);
    const lng = Number(coords?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const response = await axios.get("https://api.geoapify.com/v1/geocode/reverse", {
        params: { lat, lon: lng, format: "json", limit: 1, apiKey },
        timeout: 8000
    });

    const r = response.data?.results?.[0];
    const city =
        r?.city ||
        r?.town ||
        r?.village ||
        r?.suburb ||
        r?.county ||
        r?.state;
    const state = r?.state_code || r?.state;
    const country = r?.country_code?.toUpperCase() || r?.country;
    if (!city) return null;
    return [city, state, country].filter(Boolean).join(", ");
}

async function enrichLegPoolWithCityAddresses(legs) {
    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey) return legs;

    const cache = new Map();
    const toFetch = [];

    const consider = (loc) => {
        const key = coordKey(loc?.coordinates);
        if (!key) return;
        if (!cache.has(key)) {
            cache.set(key, undefined);
            toFetch.push({ key, coords: loc.coordinates });
        }
    };

    for (const leg of legs) {
        consider(leg?.origin);
        consider(leg?.destination);
    }

    const CONCURRENCY = 8;
    let i = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, toFetch.length) }).map(async () => {
        while (i < toFetch.length) {
            const item = toFetch[i++];
            try {
                const city = await reverseGeocodeCity(item.coords, apiKey);
                cache.set(item.key, city || null);
            } catch {
                cache.set(item.key, null);
            }
        }
    });
    await Promise.all(workers);

    const apply = (loc) => {
        const key = coordKey(loc?.coordinates);
        if (!key) return;
        const city = cache.get(key);
        if (!city) return;
        loc.address = city;
    };

    for (const leg of legs) {
        if (leg?.origin) apply(leg.origin);
        if (leg?.destination) apply(leg.destination);
    }

    return legs;
}

const MAX_LEGS = 5;
const MAX_LAYOVER_MS = 6 * 60 * 60 * 1000;
const PROXIMITY_SNAP_MILES = 3.5;
const ORIGIN_DEST_RADIUS_MILES = 75;
const MAX_DRIVING_MINUTES = 4 * 60;

const TRANSFER_BUFFER_MINUTES = {
    "Flight->Train": 60,
    "Flight->Bus": 60,
    "Train->Train": 30,
    "Train->Bus": 30,
    "Bus->Train": 30,
    "Bus->Bus": 30,
    "Driving->Flight": 45,
    "Driving->Train": 45,
    "Driving->Bus": 45,
    "Rideshare->Flight": 45,
    "Rideshare->Train": 45,
    "Rideshare->Bus": 45
};

function getTransferBufferMs(prevMode, nextMode) {
    if (!prevMode || !nextMode) return 0;
    const key = `${prevMode}->${nextMode}`;
    const minutes = TRANSFER_BUFFER_MINUTES[key];
    return (minutes ?? 30) * 60 * 1000;
}

function computeDynamicHubs(legPool, origin, destination, maxHubs = 8) {
    const counts = new Map();
  
    for (const leg of legPool) {
      const from = getHubKey(leg.origin);
      const to = getHubKey(leg.destination);
      if (from && from !== getHubKey(origin) && from !== getHubKey(destination)) {
        counts.set(from, (counts.get(from) || 0) + 1);
      }
      if (to && to !== getHubKey(origin) && to !== getHubKey(destination)) {
        counts.set(to, (counts.get(to) || 0) + 1);
      }
    }
  
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])       // most-used cities first
      .slice(0, maxHubs)                 // cap how many hubs we consider
      .map(([city]) => city);            // just return the city names
  }

async function multiModalRoutes(origin, destination, date) {
    console.log("\n========== EXECUTING STRATEGIC MULTIMODAL ENGINE ==========");

    if (primaryCity(origin?.name) === primaryCity(destination?.name)) {
        console.log("[Data] Origin and destination are same city – skipping to avoid invalid fetches");
        return [];
    }

    // Seed hubs we always consider as potential waypoints; we’ll later
    // supplement this with dynamic hubs computed from real legs.
    const waypointSeeds = ["Atlanta", "Chicago", "Charlotte", "Orlando", "Miami"];
    const fetchTasks = [];
    const seenQueries = new Set();

    const addQuery = (from, to) => {
        if (!from || !to) return;
        const fromKey = from.toLowerCase();
        const toKey = to.toLowerCase();
        const key = `${fromKey}|${toKey}`;
        if (primaryCity(from) === primaryCity(to)) return;
        if (fromKey !== toKey && !seenQueries.has(key)) {
            fetchTasks.push(fetchLegPool(from, to, date));
            seenQueries.add(key);
        }
    };

    addQuery(origin.name, destination.name);
    waypointSeeds.forEach(hub => {
        addQuery(origin.name, hub);
        addQuery(hub, destination.name);
    });

    const results = await Promise.allSettled(fetchTasks);
    const legPool = results
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => r.value);

    console.log(`[Data] Total Legs in Pool: ${legPool.length}`);

    await enrichLegPoolWithCityAddresses(legPool);

    const byMode = legPool.reduce((m, leg) => {
        const mode = leg.transportationMode || "Unknown";
        m[mode] = (m[mode] || 0) + 1;
        return m;
      }, {});
      console.log("[Debug] Leg counts by mode:", byMode);

    const hubs = addMajorHubs(extractHubsByAddress(legPool));

    // After legPool is built & enriched, compute dynamic hubs for debugging
    // and future tuning (not yet used for additional provider queries).
    const dynamicHubs = computeDynamicHubs(legPool, origin, destination);
    console.log("[Debug] dynamic hub cities:", dynamicHubs);

    const [firstMile, lastMile] = await Promise.all([
        createTargetedDrivingEdges(origin, hubs, date, "origin"),
        createTargetedDrivingEdges(destination, hubs, date, "destination")
    ]);

    const allEdges = [...legPool, ...firstMile, ...lastMile];
    console.log(`[Graph] Build Complete. Total Edges: ${allEdges.length}`);

    const edgeModes = allEdges.reduce((m, leg) => {
        const mode = leg.transportationMode || "Unknown";
        m[mode] = (m[mode] || 0) + 1;
        return m;
    }, {});
    console.log("[Debug] Edge counts by mode:", edgeModes);

    const paths = findPathsAStar(allEdges, origin, destination, date);

    return formatAndRank(paths, origin, destination);
}

function findPathsAStar(edges, origin, destination, date) {
    const startTime = new Date(date).getTime();
    let queue = [{
        currentLoc: origin,
        path: [],
        currentTime: startTime,
        totalCost: 0,
        totalDistance: 0,
        score: 0,
        distToGoal: haversine(origin.coordinates, destination.coordinates),
        visitedNodeKeys: new Set([locationKey(origin)])
    }];

    const finalPaths = [];
    const bestArrivals = new Map();

    while (queue.length > 0 && finalPaths.length < 100) {
        queue.sort((a, b) => a.score - b.score);
        const state = queue.shift();

        if (isSameLocation(state.currentLoc, destination)) {
            finalPaths.push({
                legs: state.path,
                totalCost: state.totalCost,
                totalDistance: state.totalDistance
            });
            continue;
        }

        const slot = Math.floor(new Date(state.currentTime).getHours() / 2);
        const firstMode = state.path[0]?.transportationMode || "Start";
        const nodeKey = `${state.currentLoc.address || state.currentLoc.name}-${slot}-${firstMode}`;

        if (bestArrivals.has(nodeKey) && state.currentTime > bestArrivals.get(nodeKey) + (90 * 60000)) continue;
        bestArrivals.set(nodeKey, state.currentTime);

        if (state.path.length >= MAX_LEGS) continue;

        const nextLegs = edges.filter(e => {
            if (!e.origin || !e.destination) return false;
            if (e.transportationMode === "Driving" && (e.duration || 0) > MAX_DRIVING_MINUTES) return false;
            if (state.path.length === 0) {
                return isSameLocation(e.origin, origin);
            }
            return isSameLocation(e.origin, state.currentLoc);
        });

        for (const leg of nextLegs) {
            const depTime = new Date(leg.departAt).getTime();
            const arrTime = new Date(leg.arriveAt).getTime();
            if (Number.isNaN(depTime) || Number.isNaN(arrTime)) continue;

            const prevLeg = state.path[state.path.length - 1];
            const bufferMs = state.path.length === 0
                ? 0
                : getTransferBufferMs(prevLeg.transportationMode, leg.transportationMode);

            if (depTime < state.currentTime + bufferMs) continue;

            const layoverMs = depTime - state.currentTime;
            if (state.path.length > 0 && layoverMs > MAX_LAYOVER_MS) {
                continue;
            }

            const destKey = locationKey(leg.destination);
            if (state.visitedNodeKeys.has(destKey)) continue;

            const newDist = haversine(leg.destination.coordinates, destination.coordinates);

            const travelTimeMs = arrTime - startTime;
            const heuristicMs = newDist * 4.5 * 60000;
            const transferPenaltyMs = state.path.length * 3 * 60 * 1000;

            const nextVisited = new Set(state.visitedNodeKeys);
            nextVisited.add(destKey);

            queue.push({
                currentLoc: leg.destination,
                path: [...state.path, leg],
                currentTime: arrTime,
                totalCost: state.totalCost + (leg.cost || 0),
                totalDistance: state.totalDistance + (leg.distance || 0),
                score: travelTimeMs + heuristicMs + transferPenaltyMs,
                distToGoal: newDist,
                visitedNodeKeys: nextVisited
            });
        }
    }

    console.log("[Debug] A* finalPaths:", finalPaths.length);
    const pathModeSignatures = finalPaths.slice(0, 10).map(p =>
        (p.legs || []).map(l => l.transportationMode).join("->")
    );
    console.log("[Debug] Sample path mode sequences:", pathModeSignatures);

    // Extra debug: full distribution of mode sequences,
    // and a small detailed dump of the first few multimodal paths.
    const modeSeqCounts = finalPaths.reduce((acc, p) => {
        const seq = (p.legs || []).map(l => l.transportationMode).join("->") || "EMPTY";
        acc[seq] = (acc[seq] || 0) + 1;
        return acc;
    }, {});
    console.log("[Debug] A* mode sequence counts:", modeSeqCounts);

    const multiModalSamples = finalPaths
        .filter(p => {
            const modes = new Set((p.legs || []).map(l => l.transportationMode));
            return modes.size > 1;
        })
        .slice(0, 5)
        .map((p, idx) => ({
            index: idx,
            legs: (p.legs || []).map(l => ({
                mode: l.transportationMode,
                origin: l.origin?.address || l.origin?.name,
                destination: l.destination?.address || l.destination?.name,
                departAt: l.departAt,
                arriveAt: l.arriveAt
            }))
        }));
    if (multiModalSamples.length > 0) {
        console.log("[Debug] A* multimodal sample paths:", JSON.stringify(multiModalSamples, null, 2));
    }

    return finalPaths;
}

async function fetchLegPool(from, to, date) {
    try {
        const [f, t, b] = await Promise.allSettled([
            flightService.searchFlightsCity(from, to, date),
            trainService.getTrainRoutes({ originName: from, destinationName: to, departDate: date }),
            busService.getBusRoutes({ originName: from, destinationName: to, departDate: date })
        ]);

        const flights = (f.status === 'fulfilled' ? f.value : []) || [];
        const trains = (t.status === 'fulfilled' ? t.value : []) || [];
        const buses  = (b.status === 'fulfilled' ? b.value : []) || [];

        const flightLegs = flights.flatMap(x => x.legs || []);
        const trainLegs  = trains.flatMap(x => x.legs || []);
        const busLegs    = buses.flatMap(x => x.legs || []);

        console.log("[Debug][fetchLegPool] Query:", { from, to, date });
        console.log("[Debug][fetchLegPool] Flights routes:", flights.length, "legs:", flightLegs.length);
        console.log("[Debug][fetchLegPool] Trains routes:", trains.length, "legs:", trainLegs.length);
        console.log("[Debug][fetchLegPool] Buses routes:", buses.length, "legs:", busLegs.length);

        const sample = (arr) => (arr[0] ? {
            mode: arr[0].transportationMode,
            origin: arr[0].origin?.address || arr[0].origin?.name,
            destination: arr[0].destination?.address || arr[0].destination?.name,
            departAt: arr[0].departAt,
            arriveAt: arr[0].arriveAt
        } : null);

        console.log("[Debug][fetchLegPool] Sample flight leg:", sample(flightLegs));
        console.log("[Debug][fetchLegPool] Sample train leg:", sample(trainLegs));
        console.log("[Debug][fetchLegPool] Sample bus leg:", sample(busLegs));

        return [...flightLegs, ...trainLegs, ...busLegs];
    } catch (e) { return []; }
}

function getHubKey(loc) {
    if (!loc) return "";
    const s = (loc.address || loc.name || "").toString().trim();
    return primaryCity(s) || s.toLowerCase();
}

function isSameLocation(locA, locB) {
    if (!locA || !locB) return false;
    const addrA = (locA.address || locA.name || "").toLowerCase().trim();
    const addrB = (locB.address || locB.name || "").toLowerCase().trim();
    if (addrA !== "" && (addrA === addrB || addrA.includes(addrB) || addrB.includes(addrA))) return true;
    const hubA = getHubKey(locA);
    const hubB = getHubKey(locB);
    if (hubA && hubB && (hubA === hubB || hubA.includes(hubB) || hubB.includes(hubA))) return true;
    if (locA.coordinates && locB.coordinates) {
        return haversine(locA.coordinates, locB.coordinates) < PROXIMITY_SNAP_MILES;
    }
    return false;
}

function locationKey(loc) {
    if (!loc) return "";
    const addr = (loc.address || loc.name || "").toLowerCase().trim();
    if (addr) return addr;
    if (loc.coordinates?.lat && loc.coordinates?.lng) {
        return `${loc.coordinates.lat.toFixed(3)},${loc.coordinates.lng.toFixed(3)}`;
    }
    return JSON.stringify(loc);
}

function haversine(a, b) {
    if (!a?.lat || !b?.lat) return 9999;
    const R = 3958.8;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lng - a.lng) * Math.PI / 180;
    const aVal = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}

async function createTargetedDrivingEdges(point, hubs, date, type) {
    const maxDrivingDist = (MAX_DRIVING_MINUTES - 20) * 0.7;
    const targets = hubs
        .map(h => ({ hub: h, dist: haversine(point.coordinates, h.coordinates) }))
        .filter(item => item.dist <= maxDrivingDist)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 10);

    const fallbackLeg = (item) => {
        const dur = Math.min(MAX_DRIVING_MINUTES, Math.round(item.dist / 0.7) + 20);
        return [{
            transportationMode: "Driving", provider: "Personal Vehicle",
            origin: type === "origin" ? point : item.hub, destination: type === "origin" ? item.hub : point,
            departAt: new Date(date).toISOString(), arriveAt: new Date(new Date(date).getTime() + dur * 60000).toISOString(),
            duration: dur, cost: Math.round(item.dist * 0.6), distance: item.dist
        }];
    };
    const tasks = targets.map(async (item) => {
        try {
            const routes = await drivingService.getDrivingRoutes({
                originName: type === "origin" ? point.name : item.hub.name,
                destinationName: type === "origin" ? item.hub.name : point.name,
                departDate: date
            });
            const legs = (routes[0]?.legs || []).filter(l => (l.duration || 0) <= MAX_DRIVING_MINUTES);
            return legs.length > 0 ? legs : fallbackLeg(item);
        } catch (e) {
            return fallbackLeg(item);
        }
    });
    const res = await Promise.all(tasks);
    return res.flat();
}

function extractHubsByAddress(legs) {
    const hubs = {};
    for (const leg of legs) {
        if (leg.origin) {
            const key = getHubKey(leg.origin) || (leg.origin.address || leg.origin.name);
            if (key) hubs[key] = leg.origin;
        }
        if (leg.destination) {
            const key = getHubKey(leg.destination) || (leg.destination.address || leg.destination.name);
            if (key) hubs[key] = leg.destination;
        }
    }
    return Object.values(hubs);
}

function addMajorHubs(hubs) {
    const major = [
        { name: "Chicago O'Hare Airport", coordinates: { lat: 41.9742, lng: -87.9073 }, address: "Chicago, IL" },
        { name: "Atlanta Hartsfield-Jackson Airport", coordinates: { lat: 33.6407, lng: -84.4277 }, address: "Atlanta, GA" }
    ];
    major.forEach(h => { if (!hubs.find(x => x.name === h.name)) hubs.push(h); });
    return hubs;
}

// function formatAndRank(paths, origin, destination) {
//     const deduped = Array.from(
//         paths
//         .filter(res => res.legs && res.legs.length > 0)
//         .map(res => {
//             const first = res.legs[0];
//             const last = res.legs[res.legs.length - 1];
//             const modeSeq = res.legs.map(l => l.transportationMode).join("->");

//             const departAt = first.departAt;
//             const arriveAt = last.arriveAt;
//             const totalDurationMinutes = Math.round(
//                 (new Date(arriveAt).getTime() - new Date(departAt).getTime()) / 60000
//             );

//             const totalDistance = res.totalDistance || res.legs.reduce(
//                 (sum, leg) => sum + (leg.distance || 0),
//                 0
//             );

//             const signature = `${modeSeq}-${departAt}-${arriveAt}`;

//             const base = {
//                 origin,
//                 destination,
//                 legs: res.legs,
//                 totalCost: res.totalCost,
//                 totalDuration: totalDurationMinutes,
//                 totalDistance,
//                 departAt,
//                 arriveAt,
//                 modeSequence: modeSeq,
//                 signature
//             };

//             return { ...base, score: computeRouteScore(base) };
//         })
//         .reduce((acc, route) => {
//             const existing = acc.get(route.signature);
//             if (!existing || route.score < existing.score) acc.set(route.signature, route);
//             return acc;
//         }, new Map())
//         .values()
//     );

//     console.log("[Debug] deduped routes:", deduped.length);

//     return deduped
//         .filter(r => {
//             const first = r.legs[0];
//             const last = r.legs[r.legs.length - 1];
//             if (!first?.origin || !last?.destination) return false;
//             if (!origin?.coordinates || !destination?.coordinates) return true;
//             if (!first.origin.coordinates || !last.destination.coordinates) return true;
//             const distFromOrigin = haversine(origin.coordinates, first.origin.coordinates);
//             const distToDest = haversine(destination.coordinates, last.destination.coordinates);
//             return distFromOrigin <= ORIGIN_DEST_RADIUS_MILES && distToDest <= ORIGIN_DEST_RADIUS_MILES;
//         })
//         .filter(r => !(r.legs || []).some(l => l.transportationMode === "Driving" && (l.duration || 0) > MAX_DRIVING_MINUTES))
//         .sort((a, b) => a.score - b.score)
//         .slice(0, 40);
// }

function formatAndRank(paths, origin, destination) {
    const mapped = paths
      .filter(res => res.legs && res.legs.length > 0)
      .map(res => {
                    const first = res.legs[0];
                    const last = res.legs[res.legs.length - 1];
                    const modeSeq = res.legs.map(l => l.transportationMode).join("->");
        
                    const departAt = first.departAt;
                    const arriveAt = last.arriveAt;
                    const totalDurationMinutes = Math.round(
                        (new Date(arriveAt).getTime() - new Date(departAt).getTime()) / 60000
                    );
        
                    const totalDistance = res.totalDistance || res.legs.reduce(
                        (sum, leg) => sum + (leg.distance || 0),
                        0
                    );
        
                    const signature = `${modeSeq}-${departAt}-${arriveAt}`;
        
                    const base = {
                        origin,
                        destination,
                        legs: res.legs,
                        totalCost: res.totalCost,
                        totalDuration: totalDurationMinutes,
                        totalDistance,
                        departAt,
                        arriveAt,
                        modeSequence: modeSeq,
                        signature
                    };
        
                    return { ...base, score: computeRouteScore(base) };
                });

                // Right after the .map(res => { ... }) block in formatAndRank
const modeSeqCounts = mapped.reduce((acc, r) => {
    acc[r.modeSequence] = (acc[r.modeSequence] || 0) + 1;
    return acc;
  }, {});
  console.log("[Debug] formatAndRank modeSequence counts:", modeSeqCounts);
  
  const signatureCounts = mapped.reduce((acc, r) => {
    acc[r.signature] = (acc[r.signature] || 0) + 1;
    return acc;
  }, {});
  console.log("[Debug] formatAndRank signature count (unique):", Object.keys(signatureCounts).length);
  
    // add the two logs above here
  
    // Dedupe by signature: same schedule = one route (no duplicate cards).
    const bySignature = mapped.reduce((acc, route) => {
        const existing = acc.get(route.signature);
        if (!existing || route.score < existing.score) acc.set(route.signature, route);
        return acc;
    }, new Map());
    const deduped = Array.from(bySignature.values());

    const filtered = deduped
        .filter(r => {
            const first = r.legs[0];
            const last = r.legs[r.legs.length - 1];
            if (!first?.origin || !last?.destination) return false;
            if (!origin?.coordinates || !destination?.coordinates) return true;
            if (!first.origin.coordinates || !last.destination.coordinates) return true;
            const distFromOrigin = haversine(origin.coordinates, first.origin.coordinates);
            const distToDest = haversine(destination.coordinates, last.destination.coordinates);
            return distFromOrigin <= ORIGIN_DEST_RADIUS_MILES && distToDest <= ORIGIN_DEST_RADIUS_MILES;
        })
        .filter(r => !(r.legs || []).some(l => l.transportationMode === "Driving" && (l.duration || 0) > MAX_DRIVING_MINUTES))
        .sort((a, b) => a.score - b.score);

    // Show more routes: up to MAX_PER_MODE_SEQUENCE per mode shape, then sort by score and cap total.
    const MAX_PER_MODE_SEQUENCE = 4;
    const MAX_TOTAL_ROUTES = 50;
    const byModeSeq = new Map();
    for (const r of filtered) {
        const list = byModeSeq.get(r.modeSequence) || [];
        if (list.length < MAX_PER_MODE_SEQUENCE) list.push(r);
        byModeSeq.set(r.modeSequence, list);
    }
    const diversified = Array.from(byModeSeq.values()).flat()
        .sort((a, b) => a.score - b.score)
        .slice(0, MAX_TOTAL_ROUTES);

    return diversified;
  }

function computeRouteScore(route) {
    const cost = Number(route.totalCost) || 0;
    const duration = Number(route.totalDuration) || 0;

    const legs = route.legs || [];
    const transfers = Math.max(0, legs.length - 1);

    const inVehicleMinutes = legs.reduce((sum, leg) => sum + (leg.duration || 0), 0);
    const layoverMinutes = Math.max(0, duration - inVehicleMinutes);

    const costWeight = 1.0;
    const durationWeight = 0.7;
    const transferPenaltyPerLeg = 20;
    const longLayoverPenaltyPerHour = 15;

    const longLayoverHours = Math.max(0, layoverMinutes - 90) / 60;

    return (
        cost * costWeight +
        duration * durationWeight +
        transfers * transferPenaltyPerLeg +
        longLayoverHours * longLayoverPenaltyPerHour
    );
}

module.exports = { multiModalRoutes };