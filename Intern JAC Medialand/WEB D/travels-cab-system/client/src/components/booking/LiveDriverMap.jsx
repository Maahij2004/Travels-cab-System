import { useEffect, useRef, useState } from "react";
import { createMap, computeDrivingRoute } from "../../services/mapsService";

const point = (value) => {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

const activeTripStatuses = ["Started", "Customer Picked Up", "Ongoing", "Destination Reached", "In Transit"];

const LiveDriverMap = ({ driverId, pickup, destination, status = "Scheduled" }) => {
  const elementRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const layersRef = useRef([]);
  const lastRouteAtRef = useRef(0);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    let active = true;
    const element = elementRef.current;
    if (!element) return undefined;
    createMap(element, { zoom: 13 })
      .then((map) => {
        if (!active) { map.remove(); return; }
        mapRef.current = map;
        window.setTimeout(() => map.invalidateSize(true), 120);
      })
      .catch((error) => active && setMapError(error?.message || "Live map could not be loaded."));
    return () => {
      active = false;
      markerRef.current?.remove?.();
      layersRef.current.forEach((layer) => layer?.remove?.());
      layersRef.current = [];
      mapRef.current?.remove?.();
      mapRef.current = null;
      if (element?._leaflet_id) delete element._leaflet_id;
      if (element) element.innerHTML = "";
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return undefined;
    let active = true;
    const map = mapRef.current;
    const L = window.L;
    if (!L) return undefined;

    const pickupPoint = point(pickup);
    const destinationPoint = point(destination);
    const target = activeTripStatuses.includes(status) ? destinationPoint : pickupPoint;

    const clearLayers = () => {
      layersRef.current.forEach((layer) => layer?.remove?.());
      layersRef.current = [];
    };

    const drawStatic = async () => {
      clearLayers();
      if (!pickupPoint && !destinationPoint) return;
      const pickupIcon = L.divIcon({ className: "travels-map-pin pickup-pin", html: '<span>●</span>', iconSize: [34, 34], iconAnchor: [17, 17] });
      const destinationIcon = L.divIcon({ className: "travels-map-pin destination-pin", html: '<span>●</span>', iconSize: [34, 34], iconAnchor: [17, 17] });
      if (pickupPoint) layersRef.current.push(L.marker([pickupPoint.lat, pickupPoint.lng], { icon: pickupIcon, zIndexOffset: 1000 }).addTo(map).bindTooltip("Pickup", { direction: "top" }));
      if (destinationPoint) layersRef.current.push(L.marker([destinationPoint.lat, destinationPoint.lng], { icon: destinationIcon, zIndexOffset: 1000 }).addTo(map).bindTooltip("Destination", { direction: "top" }));
      if (pickupPoint && destinationPoint) {
        try {
          const route = await computeDrivingRoute(pickupPoint, destinationPoint);
          if (!active || !mapRef.current) return;
          const path = route.path.map((p) => [p.lat, p.lng]);
          if (path.length >= 2) {
            const line = L.polyline(path, { weight: 5, opacity: 0.85, color: "#1d6fff", lineCap: "round", lineJoin: "round" }).addTo(map);
            layersRef.current.push(line);
            map.fitBounds(line.getBounds(), { padding: [38, 38], maxZoom: 15 });
          } else map.fitBounds([[pickupPoint.lat, pickupPoint.lng], [destinationPoint.lat, destinationPoint.lng]], { padding: [38, 38], maxZoom: 15 });
        } catch {
          map.fitBounds([[pickupPoint.lat, pickupPoint.lng], [destinationPoint.lat, destinationPoint.lng]], { padding: [38, 38], maxZoom: 15 });
        }
      }
    };

    const drawDriver = async (driverPosition) => {
      clearLayers();
      const driverIcon = L.divIcon({ className: "travels-map-pin driver-live-pin", html: '<span>🚕</span>', iconSize: [44, 44], iconAnchor: [22, 22] });
      const pickupIcon = L.divIcon({ className: "travels-map-pin pickup-pin", html: '<span>●</span>', iconSize: [34, 34], iconAnchor: [17, 17] });
      const destinationIcon = L.divIcon({ className: "travels-map-pin destination-pin", html: '<span>●</span>', iconSize: [34, 34], iconAnchor: [17, 17] });
      if (markerRef.current) markerRef.current.setLatLng([driverPosition.lat, driverPosition.lng]);
      else markerRef.current = L.marker([driverPosition.lat, driverPosition.lng], { icon: driverIcon, zIndexOffset: 2000 }).addTo(map).bindTooltip("Driver", { direction: "top", offset: [0, -18] });
      if (pickupPoint) layersRef.current.push(L.marker([pickupPoint.lat, pickupPoint.lng], { icon: pickupIcon, zIndexOffset: 1000 }).addTo(map).bindTooltip("Pickup", { direction: "top" }));
      if (destinationPoint) layersRef.current.push(L.marker([destinationPoint.lat, destinationPoint.lng], { icon: destinationIcon, zIndexOffset: 1000 }).addTo(map).bindTooltip("Destination", { direction: "top" }));
      if (!target) return;
      const now = Date.now();
      if (now - lastRouteAtRef.current < 12000) return;
      lastRouteAtRef.current = now;
      try {
        const route = await computeDrivingRoute(driverPosition, target);
        if (!active || !mapRef.current) return;
        const path = route.path.map((p) => [p.lat, p.lng]);
        if (path.length >= 2) {
          const line = L.polyline(path, { weight: 5, opacity: 0.9, color: "#1d6fff", lineCap: "round", lineJoin: "round" }).addTo(map);
          layersRef.current.push(line);
          map.fitBounds(line.getBounds(), { padding: [38, 38], maxZoom: 16 });
        }
      } catch { /* keep markers */ }
    };

    const poll = async () => {
      if (!driverId) { await drawStatic(); return; }
      try {
        const token = localStorage.getItem("travels_token");
        const base = (import.meta.env.VITE_API_URL || "https://travels-cab-backend.onrender.com/api").replace(/\/$/, "");
        const response = await fetch(`${base}/driver-location/driver/${driverId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) return drawStatic();
        const data = await response.json();
        const loc = data.location;
        const driverPosition = point({ lat: loc?.latitude, lng: loc?.longitude });
        if (active && driverPosition) await drawDriver(driverPosition);
        else await drawStatic();
      } catch { await drawStatic(); }
    };

    poll();
    const interval = window.setInterval(poll, 10000);
    return () => { active = false; window.clearInterval(interval); clearLayers(); };
  }, [driverId, pickup?.lat, pickup?.lng, destination?.lat, destination?.lng, status]);

  return (
    <div className="live-map-shell">
      <div className="live-map-status"><span className="gps-live"><span /> {driverId ? "Live driver location · updates every 10 seconds" : "Route preview · waiting for driver"}</span><strong>{activeTripStatuses.includes(status) ? "Driver → destination" : "Pickup → destination"}</strong></div>
      <div className="route-map live-driver-map" ref={elementRef} aria-label="Live driver tracking map" />
      {mapError && <div className="route-map-error"><strong>Live map unavailable</strong><span>{mapError}</span></div>}
    </div>
  );
};
export default LiveDriverMap;
