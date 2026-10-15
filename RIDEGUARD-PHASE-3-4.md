# RideGuard Phase 3 + Phase 4

## Phase 3 — Reliability Score + Smart Dispatch
- Driver reliability is scored from completed/cancelled trips, dispatch responses, customer ratings and serious RideGuard incidents.
- Score is bounded from 0–100 and stored on the Driver record.
- Trusted Driver status requires a high score, strong ratings and no high-severity RideGuard incidents.
- Smart dispatch ranks reliability first, Trusted Driver status second, then GPS proximity and driver age.
- Driver dashboard shows reliability score, average rating, completed trips and reward points.
- Admin can see reliability/reward fields and award 100 reward points when trusting a driver.

## Phase 4 — Payment Protection
- Online payments can only become Paid through verified Razorpay signature validation.
- Cash remains pending until the assigned driver confirms actual receipt.
- A driver cannot finalize a destination-reached trip until payment is verified.
- Customer can report a driver payment refusal through RideGuard.
- Customer dashboard can show payment protection status, method, amount and verification state.
- Payment protection endpoint: `GET /api/rideguard/payment-protection/:tripId`.

## APIs
- `GET /api/rideguard/reliability/me` — driver
- `GET /api/rideguard/reliability/:driverId` — admin/superadmin
- `PATCH /api/rideguard/rewards/:driverId` — admin/superadmin
- `GET /api/rideguard/payment-protection/:tripId` — customer
