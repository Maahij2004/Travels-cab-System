# Driver Dispatch Retry Rules

- The system offers a booking to only one driver at a time.
- Each offer remains available for 20 seconds.
- Accepting assigns the trip and stops dispatch for that booking.
- Declining is final for that booking; that driver is skipped in later rounds.
- If a driver does not respond before the offer expires, the next eligible driver is tried.
- After every non-declining eligible driver has timed out once, dispatch starts another round from the nearest eligible driver, then proceeds in distance order.
- A short MongoDB lease serializes dispatch work between the booking API and the background worker to avoid multiple simultaneous offers.
- If every eligible driver explicitly declines, no further driver popups are sent; the booking remains pending for admin intervention.
