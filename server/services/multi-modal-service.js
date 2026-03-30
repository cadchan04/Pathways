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

const MIN_BUFFER_BEFORE_FLIGHT_MINUTES = 90;

const US_HUBS = [
    { name: "Atlanta", coordinates: { lat: 33.6407, lng: -84.4277 }, address: "Atlanta, GA" },
    { name: "Boston", coordinates: { lat: 42.3656, lng: -71.0096 }, address: "Boston, MA" },
    { name: "Charlotte", coordinates: { lat: 35.2144, lng: -80.9473 }, address: "Charlotte, NC" },
    { name: "Chicago", coordinates: { lat: 41.9742, lng: -87.9073 }, address: "Chicago, IL" },
    { name: "Dallas", coordinates: { lat: 32.8968, lng: -97.038 }, address: "Dallas, TX" },
    { name: "Denver", coordinates: { lat: 39.8617, lng: -104.6731 }, address: "Denver, CO" },
    { name: "Detroit", coordinates: { lat: 42.2124, lng: -83.3534 }, address: "Detroit, MI" },
    { name: "Houston", coordinates: { lat: 29.9902, lng: -95.3368 }, address: "Houston, TX" },
    { name: "Indianapolis", coordinates: { lat: 39.7684, lng: -86.1581 }, address: "Indianapolis, IN" },
    { name: "Las Vegas", coordinates: { lat: 36.084, lng: -115.1537 }, address: "Las Vegas, NV" },
    { name: "Los Angeles", coordinates: { lat: 33.9425, lng: -118.4081 }, address: "Los Angeles, CA" },
    { name: "Miami", coordinates: { lat: 25.7959, lng: -80.287 }, address: "Miami, FL" },
    { name: "Minneapolis", coordinates: { lat: 44.882, lng: -93.2218 }, address: "Minneapolis, MN" },
    { name: "Newark", coordinates: { lat: 40.6895, lng: -74.1745 }, address: "Newark, NJ" },
    { name: "Orlando", coordinates: { lat: 28.4312, lng: -81.3081 }, address: "Orlando, FL" },
    { name: "Phoenix", coordinates: { lat: 33.4341, lng: -112.008 }, address: "Phoenix, AZ" },
    { name: "San Francisco", coordinates: { lat: 37.6213, lng: -122.379 }, address: "San Francisco, CA" },
    { name: "Seattle", coordinates: { lat: 47.4502, lng: -122.3088 }, address: "Seattle, WA" },
    { name: "Washington", coordinates: { lat: 38.8512, lng: -77.0402 }, address: "Washington, DC" }
];

const FETCH_HUB_NAMES = ["Atlanta", "Chicago", "Dallas", "Denver", "Los Angeles", "Newark"];

const TRANSFER_BUFFER_MINUTES = {
    "Flight->Train": 60,
    "Flight->Bus": 60,
    "Train->Train": 30,
    "Train->Bus": 30,
    "Train->Flight": MIN_BUFFER_BEFORE_FLIGHT_MINUTES,
    "Bus->Train": 30,
    "Bus->Bus": 30,
    "Bus->Flight": MIN_BUFFER_BEFORE_FLIGHT_MINUTES,
    "Driving->Flight": Math.max(45, MIN_BUFFER_BEFORE_FLIGHT_MINUTES),
    "Driving->Train": 45,
    "Driving->Bus": 45,
    "Rideshare->Flight": Math.max(45, MIN_BUFFER_BEFORE_FLIGHT_MINUTES),
    "Rideshare->Train": 45,
    "Rideshare->Bus": 45
};

function getTransferBufferMs(prevMode, nextMode) {
    if (!prevMode || !nextMode) return 0;
    const key = `${prevMode}->${nextMode}`;
    let minutes = TRANSFER_BUFFER_MINUTES[key] ?? 30;
    if (nextMode === "Flight" && prevMode !== "Flight") {
        minutes = Math.max(minutes, MIN_BUFFER_BEFORE_FLIGHT_MINUTES);
    }
    return minutes * 60 * 1000;
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
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxHubs)
        .map(([city]) => city);
}

function isSamePlaceByName(locA, locB) {
    const nameA = (locA?.name ?? "").toString().trim().toLowerCase();
    const nameB = (locB?.name ?? "").toString().trim().toLowerCase();
    if (nameA === "" || nameB === "") return false;
    return nameA === nameB;
}

/** If a leg's destination name is not the same as the next leg's origin name, insert a rideshare/driving leg between them. */
async function fillTransferGaps(routes, date, mpg) {
    const out = [];
    for (const route of routes) {
        const legs = route.legs || [];
        if (legs.length <= 1) {
            out.push(route);
            continue;
        }
        const newLegs = [];
        for (let i = 0; i < legs.length; i++) {
            newLegs.push(legs[i]);
            if (i === legs.length - 1) break;
            const prev = legs[i];
            const next = legs[i + 1];
            if (isSamePlaceByName(prev.destination, next.origin)) continue;
            if (next.transportationMode === "Driving") continue;

            const MIN_RIDESHARE_DISTANCE_MILES = 1;
            let distMiles = 0;
            if (prev.destination?.coordinates && next.origin?.coordinates) {
                distMiles = haversine(prev.destination.coordinates, next.origin.coordinates);
            }
            if (distMiles < MIN_RIDESHARE_DISTANCE_MILES) continue;

            const fromName = (prev.destination?.name || prev.destination?.address || "").toString().trim();
            const toName = (next.origin?.name || next.origin?.address || "").toString().trim();
            const prevArrive = new Date(prev.arriveAt).getTime();
            const departDateStr = new Date(prevArrive).toISOString().split("T")[0];

            let driveLeg = null;
            try {
                const drivingRoutes = await drivingService.getDrivingRoutes({
                    originName: fromName,
                    destinationName: toName,
                    departDate: departDateStr,
                    mpg: mpg
                });
                const firstDrive = drivingRoutes[0]?.legs?.[0];
                const legDistance = firstDrive?.distance ?? distMiles;
                if (firstDrive && (firstDrive.duration || 0) <= MAX_DRIVING_MINUTES && legDistance >= MIN_RIDESHARE_DISTANCE_MILES) {
                    const durationMin = firstDrive.duration || 0;
                    const arriveAt = new Date(prevArrive + durationMin * 60000).toISOString();
                    driveLeg = {
                        transportationMode: "Rideshare",
                        provider: "Rideshare",
                        origin: prev.destination,
                        destination: next.origin,
                        departAt: new Date(prevArrive).toISOString(),
                        arriveAt,
                        duration: durationMin,
                        distance: legDistance,
                        cost: firstDrive.cost || 0
                    };
                }
            } catch (_) { }
            if (!driveLeg && prev.destination?.coordinates && next.origin?.coordinates && distMiles >= MIN_RIDESHARE_DISTANCE_MILES) {
                const durationMin = Math.min(MAX_DRIVING_MINUTES, Math.round(distMiles / 0.5) + 15);
                const arriveAt = new Date(prevArrive + durationMin * 60000).toISOString();
                driveLeg = {
                    transportationMode: "Rideshare",
                    provider: "Rideshare",
                    origin: prev.destination,
                    destination: next.origin,
                    departAt: new Date(prevArrive).toISOString(),
                    arriveAt,
                    duration: durationMin,
                    distance: Math.round(distMiles * 10) / 10,
                    cost: Math.round(distMiles * 0.5)
                };
            }
            if (driveLeg) newLegs.push(driveLeg);
        }

        const first = newLegs[0];
        const last = newLegs[newLegs.length - 1];
        const totalDurationMinutes = Math.round(
            (new Date(last.arriveAt).getTime() - new Date(first.departAt).getTime()) / 60000
        );
        const totalDistance = newLegs.reduce((s, l) => s + (l.distance || 0), 0);
        const totalCost = newLegs.reduce((s, l) => s + (l.cost || 0), 0);
        const modeSequence = newLegs.map(l => l.transportationMode).join("->");

        out.push({
            ...route,
            legs: newLegs,
            totalDuration: totalDurationMinutes,
            totalDistance,
            totalCost,
            arriveAt: last.arriveAt,
            modeSequence
        });
    }
    return out;
}

/** Return a single route object for direct driving origin → destination, or null. */
async function getDirectDrivingRoute(origin, destination, date, mpg) {
    const dateStr = typeof date === "string" ? date.split("T")[0] : new Date(date).toISOString().split("T")[0];
    try {
        const routes = await drivingService.getDrivingRoutes({
            originName: origin?.name || origin?.address,
            destinationName: destination?.name || destination?.address,
            departDate: dateStr,
            mpg: mpg
        });
        const r = routes[0];
        if (!r?.legs?.length) return null;
        const first = r.legs[0];
        const last = r.legs[r.legs.length - 1];
        return {
            origin: r.origin || first.origin,
            destination: r.destination || last.destination,
            legs: r.legs,
            totalCost: r.totalCost || 0,
            totalDuration: r.totalDuration || 0,
            totalDistance: r.totalDistance || 0,
            departAt: first.departAt,
            arriveAt: last.arriveAt,
            modeSequence: "Driving",
            signature: `Driving-${first.departAt}-${last.arriveAt}`
        };
    } catch (_) {
        return null;
    }
}

async function multiModalRoutes(origin, destination, date, mpg) {
     console.log(`MPG:${mpg}`);

    if (primaryCity(origin?.name) === primaryCity(destination?.name)) {
        return [];
    }

    const waypointSeeds = FETCH_HUB_NAMES;
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

    const FETCH_BATCH_SIZE = 1;
    const FETCH_BATCH_DELAY_MS = 2000;
    const results = [];
    for (let i = 0; i < fetchTasks.length; i += FETCH_BATCH_SIZE) {
        const batch = fetchTasks.slice(i, i + FETCH_BATCH_SIZE);
        const batchResults = await Promise.allSettled(batch);
        results.push(...batchResults);
        if (i + FETCH_BATCH_SIZE < fetchTasks.length) {
            await new Promise(r => setTimeout(r, FETCH_BATCH_DELAY_MS));
        }
    }
    const legPool = results
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => r.value);

    // console.log(`Total Legs in Pool: ${legPool.length}`);

    await enrichLegPoolWithCityAddresses(legPool);

    const byMode = legPool.reduce((m, leg) => {
        const mode = leg.transportationMode || "Unknown";
        m[mode] = (m[mode] || 0) + 1;
        return m;
    }, {});
    // console.log("Leg counts by mode:", byMode);

    const hubs = addMajorHubs(extractHubsByAddress(legPool));

    const dynamicHubs = computeDynamicHubs(legPool, origin, destination);
    // console.log("dynamic hub cities:", dynamicHubs);

    const [firstMile, lastMile] = await Promise.all([
        createTargetedDrivingEdges(origin, hubs, date, "origin", mpg),
        createTargetedDrivingEdges(destination, hubs, date, "destination", mpg)
    ]);

    const allEdges = [...legPool, ...firstMile, ...lastMile];
    // console.log(`Build Complete. Total Edges: ${allEdges.length}`);

    const edgeModes = allEdges.reduce((m, leg) => {
        const mode = leg.transportationMode || "Unknown";
        m[mode] = (m[mode] || 0) + 1;
        return m;
    }, {});
    // console.log("Edge counts by mode:", edgeModes);

    const paths = findPathsAStar(allEdges, origin, destination, date);

    let routes = formatAndRank(paths, origin, destination);

    routes = await fillTransferGaps(routes, date, mpg);

    const drivingOnly = await getDirectDrivingRoute(origin, destination, date, mpg);
    if (drivingOnly) routes = [drivingOnly, ...routes];

    return routes;
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

    // console.log("A* finalPaths:", finalPaths.length);
    const pathModeSignatures = finalPaths.slice(0, 10).map(p =>
        (p.legs || []).map(l => l.transportationMode).join("->")
    );

    const modeSeqCounts = finalPaths.reduce((acc, p) => {
        const seq = (p.legs || []).map(l => l.transportationMode).join("->") || "EMPTY";
        acc[seq] = (acc[seq] || 0) + 1;
        return acc;
    }, {});
    // console.log("A* mode sequence counts:", modeSeqCounts);

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
        const buses = (b.status === 'fulfilled' ? b.value : []) || [];

        const flightLegs = flights.flatMap(x => x.legs || []);
        const trainLegs = trains.flatMap(x => x.legs || []);
        const busLegs = buses.flatMap(x => x.legs || []);

        const sample = (arr) => (arr[0] ? {
            mode: arr[0].transportationMode,
            origin: arr[0].origin?.address || arr[0].origin?.name,
            destination: arr[0].destination?.address || arr[0].destination?.name,
            departAt: arr[0].departAt,
            arriveAt: arr[0].arriveAt
        } : null);

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

async function createTargetedDrivingEdges(point, hubs, date, type, mpg) {
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
                departDate: date,
                mpg: mpg
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
    const byName = new Set(hubs.map(h => (h?.name || "").toLowerCase()));
    for (const h of US_HUBS) {
        if (!h?.name || byName.has(h.name.toLowerCase())) continue;
        hubs.push(h);
        byName.add(h.name.toLowerCase());
    }
    return hubs;
}

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

    const modeSeqCounts = mapped.reduce((acc, r) => {
        acc[r.modeSequence] = (acc[r.modeSequence] || 0) + 1;
        return acc;
    }, {});
    // console.log("formatAndRank modeSequence counts:", modeSeqCounts);

    const signatureCounts = mapped.reduce((acc, r) => {
        acc[r.signature] = (acc[r.signature] || 0) + 1;
        return acc;
    }, {});
    // console.log("formatAndRank signature count (unique):", Object.keys(signatureCounts).length);

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