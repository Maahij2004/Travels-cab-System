# Travels Cab — Login & Driver Dispatch Performance Fixes

## Fixed

1. **Driver ride-popup race condition**
   - Removed overlapping 1-second dispatch requests.
   - Only one `/dispatch/driver/current` request can run at a time.
   - Polling retries every ~650 ms only while there is no active offer.
   - Polling stops while an offer is visible, so the popup cannot be overwritten by a slower request.
   - Transient API failures no longer immediately replace the dashboard with `Unable to load ride requests.`
   - Expired offers are cleared immediately and the next offer is requested without waiting for another long poll.

2. **Expired-offer API latency**
   - The backend no longer makes the driver's `/dispatch/driver/current` request wait for the complete expiry + redispatch workflow.
   - Expiry/redispatch continues in the background and the next fast poll picks up the new offer.

3. **Login/session responsiveness**
   - Cached user identity is restored immediately from localStorage instead of blocking portal navigation on `/auth/me`.
   - `/auth/me` still validates the session in the background.
   - Temporary network/cold-start failures no longer log out a cached session.
   - Login pages warm the API health endpoint in the background to reduce Render cold-start impact.
   - New customer password hashes use configurable `BCRYPT_ROUNDS` (default 10).
   - Older higher-cost hashes are upgraded in the background after a successful login.

## Validation

- Server JavaScript syntax checks passed.
- Updated JSX files were parsed successfully with Babel's JSX parser.
- A production Vite build could not be executed in this Linux validation container because the uploaded `node_modules` is missing the platform-specific Rolldown native binding. Run `npm install` on the deployment/development machine before building.
