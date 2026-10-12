# Free Maps Setup

This client no longer requires Google Maps, a Google Maps API key, or Google billing.

## Mapping stack
- Leaflet map UI
- OpenStreetMap map tiles/data
- Photon geocoding/search for location suggestions
- OSRM routing for driving distance and duration

## Environment
Only the backend API URL is required:

```env
VITE_API_URL=https://travels-cab-backend.onrender.com/api
```

No Google Maps key is required.

## Important usage note
Public OpenStreetMap-related services are shared infrastructure with usage policies and limits. The client uses debounced location search and should not be treated as unlimited production infrastructure. For a production deployment, move geocoding/routing to a properly provisioned provider or self-host the required services.
