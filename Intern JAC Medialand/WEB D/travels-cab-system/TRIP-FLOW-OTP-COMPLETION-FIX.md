# Trip OTP and completion flow fix

## Updated behavior

1. When a trip is `Scheduled`, the driver can generate a six-digit pickup OTP.
2. The generated OTP is retrieved by the assigned customer through the authenticated customer endpoint and appears in the Booking & Trip History banner while the trip is waiting for pickup verification.
3. The driver API no longer returns the OTP itself. The driver asks the customer to read the code from their app and enters it in the verification dialog.
4. After verification, the OTP is consumed. The customer tracker displays `Verified` instead of a blank/dash.
5. On the driver dashboard, a trip in `Started` now has a `Confirm customer picked up` action, so the driver can continue through the remaining statuses.
6. After `Destination Reached`, the `Complete Trip` button confirms the cash receipt against the backend-calculated amount. Online payments continue to complete the trip only after gateway verification. A trip cannot be completed before payment is confirmed.

## Files changed

- `client/src/components/booking/RedTaxiDispatchTracker.jsx`
- `client/src/pages/customer/CustomerDashboard.jsx`
- `client/src/pages/driver/DriverDashboard.jsx`
- `client/src/index.css`
- `server/controllers/tripController.js`

## Notes

- The OTP is intentionally not shown after it has been successfully verified; the backend marks it as used and clears its active value.
- Keep your existing `server/.env` with your MongoDB URI and JWT secret when applying the update. The packaged ZIP omits that secret-bearing local file.
- JSX parsing and Node syntax checks passed. A full Vite production build was not run because the frontend dependencies are not installed in this workspace.
