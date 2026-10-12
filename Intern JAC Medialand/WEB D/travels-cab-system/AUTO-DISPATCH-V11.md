# V11 – Driver trips / automatic dispatch fix

## What was fixed
- New customer bookings now immediately attempt automatic driver + vehicle assignment.
- When assignment succeeds, the booking moves to `Trip Scheduled` and a Trip record is created automatically.
- When no suitable driver/vehicle is available, the booking safely remains `Pending` for Admin dispatch.
- Driver dashboard continues to load `/trips/driver/my` and now the backend repairs any older assignment that has a driver/vehicle but no Trip record.
- Existing Admin manual assignment remains available.

## Why the driver previously showed no trips
The booking creation flow created the Booking with `Pending` status but never called the existing `assignDriverAndVehicle()` service. The Driver dashboard only queried Trip documents assigned to the logged-in Driver, so a Pending booking correctly produced an empty trip list.
