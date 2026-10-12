import { useEffect, useRef, useState } from "react";
import { createMap } from "../../services/mapsService";

const ERODE_CENTER = [11.3410, 77.7172];

const validPoint = (point) => {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? [lat, lng]
    : null;
};

const clearLayers = (layers) => {
  layers.forEach((layer) => layer?.remove?.());
  layers.length = 0;
};

const RouteMap = ({ pickup, destination, route }) => {
  const mapElement = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    let active = true;
    if (!mapElement.current) return undefined;

    setMapError("");
    createMap(mapElement.current, { zoom: 12 })
      .then((map) => {
        if (!active) {
          map.remove();
          return;
        }
        mapRef.current = map;
        setMapReady(true);
        // Leaflet can calculate a wrong container size while the booking form is settling.
        window.setTimeout(() => map.invalidateSize(true), 50);
        window.setTimeout(() => map.invalidateSize(true), 300);
      })
      .catch((error) => {
        if (active) setMapError(error?.message || "Map could not be loaded. Please check your internet connection.");
      });

    return () => {
      active = false;
      clearLayers(layersRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!mapReady || !map || !L) return;

    clearLayers(layersRef.current);

    const pickupPoint = validPoint(pickup);
    const destinationPoint = validPoint(destination);
    const routePath = Array.isArray(route?.path)
      ? route.path.map(validPoint).filter(Boolean)
      : [];

    if (!pickupPoint || !destinationPoint) {
      map.setView(ERODE_CENTER, 12);
      window.setTimeout(() => map.invalidateSize(), 0);
      return;
    }

    // Use simple coloured div markers so the pins remain visible even if Leaflet's
    // default marker image asset cannot be resolved by the CDN.
    const pickupIcon = L.divIcon({
      className: "travels-map-pin pickup-pin",
      html: '<span>●</span>',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    const destinationIcon = L.divIcon({
      className: "travels-map-pin destination-pin",
      html: '<span>●</span>',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    const pickupMarker = L.marker(pickupPoint, { icon: pickupIcon, zIndexOffset: 1000 })
      .addTo(map)
      .bindTooltip("Pickup", { direction: "top", offset: [0, -14] });
    const destinationMarker = L.marker(destinationPoint, { icon: destinationIcon, zIndexOffset: 1000 })
      .addTo(map)
      .bindTooltip("Destination", { direction: "top", offset: [0, -14] });
    layersRef.current.push(pickupMarker, destinationMarker);

    if (routePath.length >= 2) {
      const line = L.polyline(routePath, {
        weight: 6,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
      layersRef.current.push(line);
      map.fitBounds(line.getBounds(), { padding: [45, 45], maxZoom: 15 });
    } else {
      map.fitBounds([pickupPoint, destinationPoint], { padding: [45, 45], maxZoom: 15 });
    }

    window.setTimeout(() => map.invalidateSize(), 50);
  }, [mapReady, pickup, destination, route]);

  return (
    <div className="route-map" ref={mapElement} aria-label="Selected pickup and destination route map">
      {mapError && <div className="route-map-error"><strong>Map unavailable</strong><span>{mapError}</span><button type="button" onClick={() => window.location.reload()}>Retry map</button></div>}
    </div>
  );
};

export default RouteMap;
