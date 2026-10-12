# V12 – RedTaxi-style Dispatch Flow

This version changes new-booking dispatch from immediate driver assignment to an offer/acceptance flow based on RedTaxi's published driver terms and app information.

## Flow

Customer booking → locate eligible nearby available drivers → send ride request to one driver → 20-second response timer →

- Accept → assign driver + vehicle → create trip → notify customer/driver
- Decline → immediately offer the next eligible driver
- Timeout → automatically expire and offer the next eligible driver
- No eligible driver → booking stays Pending and the dispatch worker retries automatically

## Matching

- Vehicle category must match the booking.
- Vehicle must be available and have enough seats.
- Driver must be active, available, and not already assigned.
- If fresh driver GPS is available, drivers are ranked by distance to pickup.
- If GPS is unavailable, the system falls back to an available-driver queue.

## Important source boundary

RedTaxi's public driver terms explicitly support driver accept/decline, a timer, forwarding to other nearby drivers, and cancellation redirection. RedTaxi's privacy policy/app information also supports location-based nearby-driver matching and live ride tracking.

The exact request timeout duration is not publicly specified in the sources reviewed, so this implementation uses 20 seconds as an application setting rather than claiming it is RedTaxi's exact timeout.

The public RedTaxi sources reviewed mention OTP/autofill for authentication, but do not establish a passenger-to-driver OTP as the exact trip-start mechanism. Therefore this V12 does not claim that trip-start OTP is a RedTaxi feature.
