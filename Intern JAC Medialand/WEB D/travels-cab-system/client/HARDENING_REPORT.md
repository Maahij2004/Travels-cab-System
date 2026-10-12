# Travels Cab Client — Final V5 hardening report

## Authentication
- JWT is stored and sent through the Axios interceptor.
- 401 responses clear the session and synchronize AuthContext.
- Role-based routes protect customer, driver and admin areas.
- Super Admin and Admin use the same protected administration shell.

## Exact location and routing
- Replaced first-result Nominatim/OSRM geocoding with Google Places selection.
- Customer must select a place suggestion before a route is calculated.
- Selected place stores place ID, address, latitude and longitude.
- Google Routes `Route.computeRoutes()` calculates driving distance and duration.
- Fare distance is rounded up only after the exact road distance is known.
- Route map displays selected pickup/destination and the route path.
- Live driver location polls every 10 seconds while sharing is enabled.

## Customer
- Multi-trip booking types supported by the backend.
- Exact pickup/drop selection.
- Date and time pickers.
- Passenger validation.
- Vehicle categories from backend.
- Fare preview from `/api/fares/calculate`.
- Booking history and cancellation.
- Completed-trip rating.
- Payment UI for Cash, UPI, Card and Wallet with Razorpay verification hook.
- Invoice/payment history.
- Support tickets.
- SOS.
- Trip sharing.
- Live driver map when an assigned driver location is available.

## Driver
- Assigned trips.
- Full trip status progression controls.
- Availability controls.
- GPS location sharing with 10-second updates.
- Driver support ticket.
- SOS.

## Admin / Super Admin
- Dashboard statistics.
- Booking management.
- Automatic assignment.
- Manual driver/vehicle assignment.
- Driver management/status.
- Vehicle management/status.
- Customer list.
- Dynamic vehicle categories.
- Pricing list.
- Coupon creation/list.
- Payment list.
- Reports.
- Support tickets.
- SOS alerts.

## UI
- Preserves the premium ivory/charcoal/champagne-gold design.
- Real photographic Mini/Sedan/SUV/Premium fleet imagery.
- Vehicle showcase contains no prices.
- Booking card is above hero artwork; background image/decorations cannot cover form controls.
- Responsive mobile navigation and dashboard layouts.

## Verification
- ESLint passes with zero errors in the final source.
- The audit environment's bundled Vite/Rolldown installation is missing its Linux-native optional binding, so a production build could not be executed in this Linux container. Reinstall dependencies on Windows with `npm.cmd install` before `npm.cmd run build`.
