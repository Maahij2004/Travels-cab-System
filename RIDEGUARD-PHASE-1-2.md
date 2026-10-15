# RideGuard Phase 1 + Phase 2

## Phase 1 — Auto Rescue + Commitment Timer
- Driver acceptance starts a 2-minute commitment timer.
- If the driver remains in the pre-pickup scheduled state until the timer expires, the dispatch worker automatically:
  - cancels the scheduled trip instance,
  - releases the driver and vehicle,
  - returns the booking to Pending,
  - records a RideGuard incident,
  - starts dispatch again for another eligible driver.
- Customer can also manually report driver not moving, driver asked to cancel, driver unresponsive, or driver no-show. These reports can immediately activate Auto Rescue.

## Phase 2 — Fare Lock + Extra Fare Protection
- The quoted booking fare is copied to `booking.lockedFare` when the booking is created.
- The lock timestamp and reason are stored.
- Trip creation uses the locked fare as the base fare.
- Customer RideGuard screen shows the locked fare.
- Customer can report an extra-fare demand and submit the requested amount.
- Admin RideGuard table shows locked fare, requested amount, incident type, customer, driver, vehicle and resolution status.

## API
- `POST /api/rideguard/incidents`
- `GET /api/rideguard/incidents/my`
- `GET /api/rideguard/my`
- `GET /api/rideguard/incidents` (admin/superadmin)
- `PATCH /api/rideguard/incidents/:id` (admin/superadmin)
