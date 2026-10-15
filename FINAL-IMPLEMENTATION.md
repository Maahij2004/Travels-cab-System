# Travels Cab & Travel Booking Management System — Final Implementation

## Locked end-to-end flow

1. Customer selects exact pickup/drop on the free OpenStreetMap/Photon/OSRM map stack.
2. System calculates road distance, driving ETA and admin-configured fare.
3. Customer can book for self or someone else; passenger details are stored separately.
4. Booking enters `Pending` and dispatch searches for the nearest eligible driver.
5. Driver receives a 20-second Accept/Decline request. Decline/timeout forwards to the next eligible driver.
6. Accepting a request assigns driver + suitable vehicle and creates the scheduled trip.
7. Driver reaches pickup and generates a one-time 6-digit pickup OTP.
8. Customer sees the OTP in the active trip view; the driver enters it to start the trip.
9. Driver GPS updates every 10 seconds. Customer sees live driver location and road-route state.
10. Driver advances: Started → Customer Picked Up → Ongoing → Destination Reached.
11. At Destination Reached, payment is required before completion.
12. Cash: customer requests Cash payment; driver confirms receipt of the exact system-generated fare. Driver cannot edit the amount.
13. UPI/Card/Wallet: Razorpay verifies payment; the system completes the trip automatically.
14. Only after payment is confirmed: Trip/Booking become Completed, driver/vehicle become Available and invoice is generated.
15. Customer can then rate the driver 1–5 stars with an optional review. Driver does not rate the customer.

## Hardening included

- Dispatch offer history is retained to prevent duplicate sequence errors and immediate re-offering of the same driver.
- Duplicate dispatch writes are retried safely when concurrent worker ticks race.
- Driver acceptance checks prevent a second driver from taking an already-assigned booking.
- Active drivers must be active and have a non-expired license; verified-driver support is included while legacy seeded drivers without the field remain compatible.
- Customer cancellation cancels pending dispatch offers.
- Driver pre-pickup cancellation releases the assignment and automatically re-dispatches the booking.
- Pickup OTP is hashed for verification and encrypted for customer display, expires after 10 minutes, is single-use, and locks after repeated failures.
- Driver cannot start a trip through the generic status API without OTP verification.
- Trip completion is blocked until payment is confirmed.
- Cash payment confirmation is restricted to the assigned driver (admin override remains available through the admin payment workflow).
- Payment is tied to the system-generated final fare; the driver cannot change the amount.

## Existing platform modules retained

Authentication/RBAC, customer/driver/admin portals, vehicles, dynamic vehicle categories, configurable pricing, fare calculation, coupons, bookings, dispatch, trips, GPS, waiting/no-show, payments/Razorpay, invoices, ratings, SOS, trip sharing, notifications, support tickets, lost & found, commissions, dashboard, reports and separate role portals.

## Portal ports

- Portal selector: `5173`
- Customer: `5175`
- Driver: `5177`
- Admin/Super Admin: `5179`
- API: `5000`

## Environment

Backend requires `PORT`, `MONGO_URI`, and `JWT_SECRET` in `server/.env`. Razorpay is optional until online payment is enabled.

Client uses `VITE_API_URL=http://localhost:5000/api`.

## Verification note

All backend JavaScript files were syntax-checked successfully in the build workspace. The client dependency installation/build could not be completed in this environment because the package installation transport timed out; the project source and lockfiles are included for local `npm.cmd ci` / `npm.cmd run build:*` verification.

## RideGuard Phase 5–6
- Admin Incident Center with incident summary and resolution queue.
- Transparent fare ledger for customers and Admin Fare Guard comparison.
- Driver reward wallet with tiers and reward ledger.
- Automatic 25-point completed-trip reward and 10-point reward for ratings of 4–5.
