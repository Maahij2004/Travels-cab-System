# RideGuard Phase 5 + Phase 6

## Phase 5 — Admin Incident Center
- Dedicated Admin Incident Center section.
- Central incident queue with total/open/investigating/resolved/rejected/critical/high counts.
- Incidents can be moved to Investigating, Resolved or Rejected.
- When an admin starts investigation, the incident is automatically assigned to that admin when no owner exists.
- Incident records expose severity, customer, driver, vehicle, locked fare, requested extra amount, resolution and admin notes.
- Admin incident API supports status/severity/type filtering through `/api/rideguard/incidents` and a dedicated center route `/api/rideguard/admin/incident-center`.

## Phase 6 — Transparent Fare + Driver Rewards
- Customer transparent fare ledger shows original estimate, locked fare, coupon discount, waiting charge, approved other adjustments and final fare.
- Admin Fare Guard table compares locked fare against final fare and shows visible variance.
- Driver Rewards wallet shows reward tier, points, next tier, trusted status and reward history.
- Completing a trip automatically awards 25 driver reward points.
- A driver rating of 4 or 5 stars automatically awards 10 reward points.
- Admin can add/deduct reward points; every change is written to the reward ledger.
- Reward tiers: Starter (0), Silver (500), Gold (1000), Elite (2000).

## New APIs
- `GET /api/rideguard/admin/incident-center`
- `GET /api/rideguard/admin/fare-transparency`
- `GET /api/rideguard/fare-transparency/:bookingId`
- `GET /api/rideguard/rewards/me`
- `GET /api/rideguard/rewards/:driverId/ledger`
- `PATCH /api/rideguard/rewards/:driverId`

## New model
- `server/models/DriverRewardLedger.js`
