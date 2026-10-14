# Travels Cab — Final Client V5

Premium React/Vite client for the Travels Cab & Travel Booking Management System.

## Run

```powershell
npm.cmd install
npm.cmd run dev
```

For a production build:

```powershell
npm.cmd run build
```

## Environment

Copy `.env.example` to `.env` and add your Google Maps browser key.

```env
VITE_API_URL=https://travels-cab-backend.onrender.com/api
VITE_API_URL=https://travels-cab-backend.onrender.com/api
```

See `GOOGLE_MAPS_SETUP.md` for Google Cloud configuration.

## Important production requirements

- Restrict the Google Maps browser key by HTTP referrer.
- Enable Maps JavaScript API, Places API (New), and Routes API.
- Configure real Razorpay keys on the server before enabling online payments.
- Keep `.env` out of source control.

## Main source areas

- `src/pages/HomePage.jsx` — landing page and fleet
- `src/components/booking/BookingPanel.jsx` — homepage booking panel
- `src/components/booking/ExactLocationPicker.jsx` — exact Google Places selection
- `src/components/booking/RouteMap.jsx` — route preview
- `src/components/booking/LiveDriverMap.jsx` — live driver location
- `src/pages/customer/CustomerDashboard.jsx` — customer operations
- `src/pages/driver/DriverDashboard.jsx` — driver operations
- `src/pages/admin/AdminDashboard.jsx` — admin operations
- `src/services/mapsService.js` — Google Maps/Places/Routes integration
- `src/services/api.js` — backend API client


## Maps
This version uses Leaflet + OpenStreetMap + Photon + OSRM. No Google Maps API key or Google billing is required.
See `FREE_MAPS_SETUP.md` for details and public-service usage considerations.
