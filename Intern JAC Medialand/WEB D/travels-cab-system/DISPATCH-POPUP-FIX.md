# Driver ride popup fix

## What changed

- Ride offers display as a centered modal overlay on the driver dashboard, with Accept and Decline actions. The modal remains visible until the driver responds or the offer timer expires.
- In local development only (`NODE_ENV` is not `production`), server startup migrates existing active driver records to `isVerified: true`. The original seeded/admin-created test drivers were being saved with `isVerified: false`, which caused the dispatch query to exclude every driver.
- Drivers created by an authenticated administrator are now marked verified at creation. In production, do not run the development migration; keep your explicit driver verification process.
- Drivers do not need to enable GPS just to receive a request. Fresh GPS data is used to order drivers by distance; drivers without a current location remain eligible and are ordered after drivers with usable location data.
- Backend logs now report offer delivery and a rate-limited reason when a booking has no eligible driver/vehicle.

## Run locally

1. Stop the server and driver portal.
2. Replace the project files, but keep your existing `server/.env` secrets.
3. In the server folder run `npm.cmd install`, then `npm.cmd run dev`.
4. In the client folder run `npm.cmd run dev:driver` and open `http://localhost:5177/`.
5. Confirm the server logs show a line like `[dispatch] BK-...: offer #1 (round 1) sent to DRV-...`. The first eligible driver should see the popup.

## If there is still no popup

Check the server terminal. The dispatch warning identifies whether there is no available matching vehicle, or no available/verified driver with an unexpired license. Confirm the chosen vehicle category has at least one vehicle with `availability: true` and `status: "Available"`, and that at least one driver has `availability: true`, `status: "Available"`, `isActive: true`, and an unexpired `licenseExpiry`. Also confirm the driver is logged in at port 5177.
