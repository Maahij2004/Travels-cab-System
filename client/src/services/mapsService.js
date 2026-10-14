const DEFAULT_CENTER = { lat: 11.3410, lng: 77.7172 }; // Erode, Tamil Nadu
const PHOTON_URL = "https://photon.komoot.io/api/";
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
let leafletPromise;

const LEAFLET_SOURCES = [
  "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
];
const LEAFLET_CSS = [
  "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
];

const ensureLeafletCss = () => {
  const existing = document.querySelector('link[data-travels-leaflet-css]');
  if (existing) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = LEAFLET_CSS[0];
  link.dataset.travelsLeafletCss = "true";
  link.onerror = () => { link.href = LEAFLET_CSS[1]; };
  document.head.appendChild(link);
};

const loadScript = (src) => new Promise((resolve, reject) => {
  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.dataset.travelsLeaflet = "true";
  script.onload = () => window.L ? resolve(window.L) : reject(new Error("Leaflet loaded without its map API."));
  script.onerror = () => reject(new Error(`Leaflet CDN failed: ${src}`));
  document.head.appendChild(script);
});

const loadLeaflet = () => {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  ensureLeafletCss();
  leafletPromise = (async () => {
    let lastError;
    for (const source of LEAFLET_SOURCES) {
      try {
        const L = await loadScript(source);
        if (L) return L;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("Unable to load Leaflet.");
  })().catch((error) => {
    leafletPromise = null;
    throw error;
  });
  return leafletPromise;
};

export const isMapsConfigured = true;
export const isFreeMapsConfigured = true;

const photonLabel = (feature) => {
  const p = feature?.properties || {};
  return [p.name, p.street, p.district, p.city || p.locality, p.state, p.country]
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .join(", ");
};

export const searchPlaces = async (input) => {
  const query = input?.trim();
  if (!query || query.length < 3) return [];
  const url = `${PHOTON_URL}?q=${encodeURIComponent(`${query}, India`)}&limit=6&lang=en`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Location search is temporarily unavailable.");
  const data = await response.json();
  return (data.features || []).map((feature, index) => {
    const [lng, lat] = feature.geometry?.coordinates || [];
    const p = feature.properties || {};
    const name = p.name || p.street || p.city || "Selected location";
    const address = photonLabel(feature);
    return {
      placeId: feature.properties?.osm_id ? `${feature.properties.osm_type || "osm"}-${feature.properties.osm_id}` : `${lat}-${lng}-${index}`,
      mainText: name,
      secondaryText: address.replace(name, "").replace(/^,\s*/, ""),
      lat: Number(lat),
      lng: Number(lng),
      name,
      address,
    };
  }).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
};

export const createAutocompleteSession = async () => null;
export const getCurrentLocation = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) return reject(new Error("Location services are not available on this device."));
  navigator.geolocation.getCurrentPosition(
    (position) => resolve({
      placeId: "device-current-location",
      name: "Current location",
      address: "Your current location",
      lat: Number(position.coords.latitude),
      lng: Number(position.coords.longitude),
      types: ["current_location"],
    }),
    () => reject(new Error("Allow location access to use your current location.")),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
  );
});


export const resolvePlace = async (prediction) => {
  if (!prediction?.lat || !prediction?.lng) throw new Error("Select a location from the suggestions.");
  return {
    placeId: prediction.placeId,
    name: prediction.name || prediction.mainText || "Selected location",
    address: prediction.address || prediction.secondaryText || prediction.name || "",
    lat: Number(prediction.lat),
    lng: Number(prediction.lng),
    types: [],
  };
};

export const computeDrivingRoute = async (pickup, destination) => {
  if (!pickup?.lat || !pickup?.lng || !destination?.lat || !destination?.lng) {
    throw new Error("Select both exact pickup and destination locations.");
  }
  const coordinates = `${pickup.lng},${pickup.lat};${destination.lng},${destination.lat}`;
  const url = `${OSRM_URL}/${coordinates}?overview=full&geometries=geojson&steps=false`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Unable to calculate the road route right now.");
  const data = await response.json();
  const route = data.routes?.[0];
  if (!route) throw new Error("No drivable route was found between the selected locations.");
  const distanceMeters = Number(route.distance);
  const durationSeconds = Number(route.duration);
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) throw new Error("The routing service returned an invalid distance.");
  const path = route.geometry?.coordinates?.map(([lng, lat]) => ({ lat, lng })) || [];
  return {
    route,
    distanceKmExact: Number((distanceMeters / 1000).toFixed(1)),
    distanceKm: Math.max(1, Math.ceil(distanceMeters / 1000)),
    durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
    path,
  };
};

export const createMap = async (element, options = {}) => {
  if (!element) throw new Error("Map container is missing.");
  const L = await loadLeaflet();
  if (element._leaflet_id) {
    try { element._leaflet_map?.remove?.(); } catch { /* noop */ }
  }
  const map = L.map(element, { zoomControl: true, attributionControl: true, ...options });
  const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
    crossOrigin: true,
  }).addTo(map);
  tiles.on("tileerror", () => {
    // Keep the map usable if a particular OSM tile server response fails.
    if (!map._travelsTileFallback) {
      map._travelsTileFallback = true;
      L.tileLayer("https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors, OSM France',
      }).addTo(map);
    }
  });
  map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], options.zoom || 12);
  window.setTimeout(() => map.invalidateSize(true), 0);
  window.setTimeout(() => map.invalidateSize(true), 250);
  return map;
};

export const addAdvancedMarker = async (map, position, title) => {
  const L = await loadLeaflet();
  return L.marker([position.lat, position.lng], { title }).addTo(map);
};
