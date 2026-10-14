# Final Fare and Driver Payment Verification

## Intended trip lifecycle

1. The driver sets the trip to **Destination Reached**.
2. The customer dashboard automatically opens the final-fare popup. It shows the final backend fare, pickup and destination, payment method and current payment status.
3. The customer chooses a payment method:
   - **Cash:** the system creates a Pending payment. The customer pays the displayed amount to the driver.
   - **UPI/Card/Wallet:** the payment gateway verifies the transaction and records the payment as Paid.
4. The assigned driver's dashboard refreshes the payment status every five seconds and shows the method, status, and final fare.
5. The driver selects **Verify payment status & complete trip**. For Cash/Pending, the driver must confirm actual receipt. For online payments, the driver can confirm only after the gateway status is Paid.
6. Driver verification finalizes the trip, updates the booking's payment/trip status, makes the driver and vehicle available, and generates the digital invoice.

## Safety / correctness rules

- The fare is always taken from the backend trip/booking data; the driver cannot type or alter an amount.
- A Pending online payment cannot be confirmed by the driver.
- An online gateway callback can mark the payment Paid, but it does **not** complete the trip by itself.
- Cash remains Pending until the driver confirms receipt.
- The assigned driver and a `Destination Reached` trip are required for driver verification.
- Admin recording of a cash payment does not bypass the assigned driver's final status verification.

## Local run

Keep the existing `server/.env` with your own MongoDB URI and JWT secret. From `client`, install dependencies if needed and start the customer and driver portals using the project's existing scripts:

```powershell
npm.cmd install
npm.cmd run dev:customer
npm.cmd run dev:driver
```

The backend should be running separately on port 5000. Do not overwrite your existing environment files when updating the project.
