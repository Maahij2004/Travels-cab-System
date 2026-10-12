import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, CreditCard, LogOut, MessageCircle, Navigation, Phone, RefreshCw, Receipt, Send, Share2, ShieldAlert, Star, Wallet, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import ExactLocationPicker from "../../components/booking/ExactLocationPicker";
import { computeDrivingRoute } from "../../services/mapsService";
import loadingGif from "../../assets/travels-loading.gif";
import RedTaxiDispatchTracker from "../../components/booking/RedTaxiDispatchTracker";
import RedTaxiFareBreakdown from "../../components/booking/RedTaxiFareBreakdown";

const initialForm = { travelDate: "", travelTime: "", pickupLocation: "", dropLocation: "", pickupPlace: null, dropPlace: null, vehicleCategory: "", passengerCount: "1", tripType: "one_way", distanceKm: "", distanceKmExact: "", durationHours: "4", specialRequirements: "", couponCode: "" };
const bookingTypes = [["One Way", "one_way"], ["Round Trip", "round_trip"], ["Hourly", "hourly"], ["Airport Pickup", "airport_pickup"], ["Airport Drop", "airport_drop"], ["Local Travel", "local_travel"], ["Outstation", "outstation_travel"]];
const cancellable = ["Pending", "Confirmed", "Driver Assigned", "Vehicle Assigned", "Trip Scheduled"];

const CustomerDashboard = () => {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState("book");
  const [categories, setCategories] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [trips, setTrips] = useState([]);
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [fare, setFare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [rating, setRating] = useState({});
  const [ratingLoading, setRatingLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [supportText, setSupportText] = useState("");
  const [sosText, setSosText] = useState("");
  const [bookForOther, setBookForOther] = useState(false);
  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");
  const [pickupOtp, setPickupOtp] = useState(null);
  const [fareModalOpen, setFareModalOpen] = useState(false);
  const [dismissedFareTripId, setDismissedFareTripId] = useState(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const loadCore = useCallback(async () => {
    setLoading(true);
    try {
      // A newly registered customer has a User account immediately, while the
      // legacy backend may create the Customer profile lazily. Ensure the
      // profile exists before loading any customer-owned resources.
      await api.get("/customers/me");

      const [categoryResponse, bookingResponse, tripResponse] = await Promise.all([
        api.get("/vehicle-categories/active"), api.get("/bookings/my"), api.get("/trips/customer/my"),
      ]);
      const cats = categoryResponse.data.categories || categoryResponse.data.vehicleCategories || [];
      setCategories(cats); setBookings(bookingResponse.data.bookings || []); setTrips(tripResponse.data.trips || []);
      setForm((current) => ({ ...current, vehicleCategory: current.vehicleCategory || cats[0]?._id || "" }));
    } catch (err) { setError(err.response?.data?.message || "Unable to load your travel data."); }
    finally { setLoading(false); }
  }, []);

  // Keep trip status current in every customer tab so the final-fare popup
  // appears as soon as the driver reaches the destination, not only on History.
  useEffect(() => {
    let alive = true;
    const refreshTripStatus = async () => {
      try {
        const [bookingResponse, tripResponse] = await Promise.all([
          api.get("/bookings/my"),
          api.get("/trips/customer/my"),
        ]);
        if (!alive) return;
        setBookings(bookingResponse.data.bookings || []);
        setTrips(tripResponse.data.trips || []);
      } catch {
        // Background polling should not disrupt the current screen.
      }
    };
    const timer = window.setInterval(refreshTripStatus, 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  const loadTripRatings = useCallback(async (tripList) => {
    const completedTrips = tripList.filter((trip) => trip.status === "Completed");
    if (!completedTrips.length) return;
    setRatingLoading(true);
    try {
      const results = await Promise.all(completedTrips.map(async (trip) => {
        try {
          const response = await api.get(`/ratings/trip/${trip._id}`);
          const existing = response.data.rating || response.data;
          return [trip._id, existing];
        } catch {
          return [trip._id, null];
        }
      }));
      setRating((current) => {
        const next = { ...current };
        results.forEach(([tripId, existing]) => {
          if (existing) next[tripId] = { ...next[tripId], existing };
        });
        return next;
      });
    } finally {
      setRatingLoading(false);
    }
  }, []);

  const loadFinance = useCallback(async () => {
    try {
      const [paymentsResponse, invoicesResponse] = await Promise.all([api.get("/payments/my"), api.get("/invoices/my")]);
      setPayments(paymentsResponse.data.payments || []); setInvoices(invoicesResponse.data.invoices || []);
    } catch (err) { setError(err.response?.data?.message || "Unable to load payment history."); }
  }, []);

  const downloadInvoice = (invoice) => {
    const booking = invoice.booking || {};
    const customer = invoice.customer || {};
    const amount = Number(invoice.totalAmount ?? invoice.amount ?? 0);
    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(invoice.invoiceNumber || "Travels Invoice")}</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#171717;max-width:760px;margin:auto}h1{margin-bottom:4px}.muted{color:#666}.row{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:12px 0}.total{font-size:22px;font-weight:700;margin-top:20px}</style></head><body><h1>TRAVELS</h1><p class="muted">Digital Travel Invoice</p><div class="row"><span>Invoice</span><strong>${escapeHtml(invoice.invoiceNumber || invoice._id)}</strong></div><div class="row"><span>Booking</span><strong>${escapeHtml(booking.bookingId || "—")}</strong></div><div class="row"><span>Customer</span><strong>${escapeHtml(customer.fullName || customer.name || "Customer")}</strong></div><div class="row"><span>Pickup</span><span>${escapeHtml(booking.pickupLocation || "—")}</span></div><div class="row"><span>Destination</span><span>${escapeHtml(booking.dropLocation || "—")}</span></div><div class="row total"><span>Total</span><span>₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></div><p class="muted">Generated by Travels Cab & Travel Booking System.</p></body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${invoice.invoiceNumber || "travels-invoice"}.html`;
    document.body.appendChild(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
  };

  const loadSupport = useCallback(async () => {
    try { const response = await api.get("/support/my"); setTickets(response.data.tickets || []); } catch (err) { setError(err.response?.data?.message || "Unable to load support tickets."); }
  }, []);

  useEffect(() => { loadCore(); }, [loadCore]);
  useEffect(() => { if (trips.length) loadTripRatings(trips); }, [trips, loadTripRatings]);
  useEffect(() => { const draft = sessionStorage.getItem("travels_booking_draft"); if (draft) { try { setForm((current) => ({ ...current, ...JSON.parse(draft) })); } catch { sessionStorage.removeItem("travels_booking_draft"); } } }, []);
  useEffect(() => { if (tab === "payments") loadFinance(); if (tab === "support") loadSupport(); }, [tab, loadFinance, loadSupport]);

  useEffect(() => {
    if (!form.pickupPlace || !form.dropPlace) { setRoute(null); update("distanceKm", ""); update("distanceKmExact", ""); return undefined; }
    let cancelled = false; setRouteLoading(true); setError("");
    computeDrivingRoute(form.pickupPlace, form.dropPlace).then((result) => { if (!cancelled) { setRoute(result); update("distanceKm", String(result.distanceKm)); update("distanceKmExact", String(result.distanceKmExact)); } }).catch((err) => { if (!cancelled) { setRoute(null); update("distanceKm", ""); setError(err.message || "Unable to calculate route."); } }).finally(() => { if (!cancelled) setRouteLoading(false); });
    return () => { cancelled = true; };
  }, [form.pickupPlace, form.dropPlace]);

  useEffect(() => {
    if (!route || !form.vehicleCategory || !form.tripType) { setFare(null); return undefined; }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await api.post("/fares/calculate", { vehicleCategoryId: form.vehicleCategory, tripType: form.tripType, distanceKm: Number(form.distanceKm || 0), hours: form.tripType === "hourly" ? Number(form.durationHours || 0) : 0 });
        if (!cancelled) setFare(response.data.fare || null);
      } catch { if (!cancelled) setFare(null); }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [route, form.vehicleCategory, form.tripType, form.distanceKm, form.durationHours]);

  const submitBooking = async (event) => {
    event.preventDefault(); setError(""); setMessage("");
    if (!form.pickupPlace || !form.dropPlace || !route) return setError("Select exact pickup and destination locations and wait for the route.");
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        pickupPlace: undefined,
        dropPlace: undefined,
        pickupLatitude: Number(form.pickupPlace.lat),
        pickupLongitude: Number(form.pickupPlace.lng),
        dropLatitude: Number(form.dropPlace.lat),
        dropLongitude: Number(form.dropPlace.lng),
        passengerCount: Number(form.passengerCount),
        distanceKm: Number(form.distanceKm),
        durationHours: form.tripType === "hourly" ? Number(form.durationHours || 0) : 0,
        bookingForSomeoneElse: bookForOther,
        passengerName: bookForOther ? passengerName : user?.name,
        passengerPhone: bookForOther ? passengerPhone : user?.phone,
      };
      const response = await api.post("/bookings", payload);
      setMessage(response.data.message || "Booking created successfully."); sessionStorage.removeItem("travels_booking_draft"); setForm((current) => ({ ...initialForm, vehicleCategory: current.vehicleCategory })); await loadCore(); setTab("history");
    } catch (err) { setError(err.response?.data?.message || "Unable to create booking."); } finally { setSubmitting(false); }
  };

  const cancelBooking = async (id) => {
    if (!window.confirm("Cancel this booking?")) return;
    try { await api.patch(`/bookings/${id}/cancel`, { reason: "Cancelled by customer" }); setMessage("Booking cancelled successfully."); await loadCore(); } catch (err) { setError(err.response?.data?.message || "Unable to cancel booking."); }
  };

  const createPayment = async (tripId) => {
    setPaymentSubmitting(true);
    setError("");
    try {
      const response = await api.post("/payments", { tripId, method: paymentMethod });
      const currentPayment = response.data.payment;
      if (currentPayment) {
        setPayments((current) => [currentPayment, ...current.filter((item) => String(item.trip?._id || item.trip) !== String(tripId))]);
      }

      // A payment can be gateway-verified but must still be checked by the
      // assigned driver before the trip is marked Completed.
      if (currentPayment?.status === "Paid" && !response.data.order) {
        setMessage("Payment is recorded as Paid. Your driver must verify the payment status before trip completion.");
        setPaymentSubmitting(false);
        await Promise.all([loadFinance(), loadCore()]);
        return;
      }

      if (paymentMethod === "Cash") {
        setMessage("Cash payment method saved. Please pay the displayed fare to your driver; the driver will verify receipt in the app.");
        setPaymentSubmitting(false);
        await Promise.all([loadFinance(), loadCore()]);
        return;
      }

      const { order, razorpayKey } = response.data;
      if (!order || !window.Razorpay || !razorpayKey) throw new Error("Online payment is not configured yet. Use Cash or configure Razorpay keys.");
      const rzp = new window.Razorpay({
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency || "INR",
        name: "Travels Cab",
        order_id: order.id,
        handler: async (result) => {
          try {
            const verified = await api.post("/payments/verify", { razorpayOrderId: result.razorpay_order_id, razorpayPaymentId: result.razorpay_payment_id, razorpaySignature: result.razorpay_signature });
            if (verified.data.payment) setPayments((current) => [verified.data.payment, ...current.filter((item) => String(item.trip?._id || item.trip) !== String(tripId))]);
            setMessage("Online payment verified. Your driver will verify the payment status before completing the trip.");
            await Promise.all([loadFinance(), loadCore()]);
          } catch (err) {
            setError(err.response?.data?.message || "We could not verify the payment. Please check payment status before retrying.");
          } finally {
            setPaymentSubmitting(false);
          }
        },
        modal: { ondismiss: () => setPaymentSubmitting(false) },
      });
      rzp.open();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Payment could not be started.");
      setPaymentSubmitting(false);
    }
  };

  const rateTrip = async (tripId) => {
    const value = Number(rating[tripId]?.score || 0); if (!value) return setError("Choose a rating from 1 to 5.");
    try {
      const response = await api.post("/ratings", { tripId, rating: value, review: rating[tripId]?.review || "" });
      const existing = response.data.rating || response.data;
      setRating((current) => ({ ...current, [tripId]: { ...current[tripId], existing } }));
      setMessage("Thanks for rating your driver.");
    } catch (err) { setError(err.response?.data?.message || "Unable to submit rating."); }
  };

  const createTicket = async () => { if (!supportText.trim()) return; try { await api.post("/support", { subject: "Customer support", description: supportText.trim() }); setSupportText(""); setMessage("Support ticket created."); await loadSupport(); } catch (err) { setError(err.response?.data?.message || "Unable to create ticket."); } };
  const triggerSOS = async () => { try { await api.post("/SOS", { message: sosText || "Emergency assistance requested" }); setSosText(""); setMessage("SOS alert sent to operations."); } catch (err) { setError(err.response?.data?.message || "Unable to send SOS."); } };
  const shareTrip = async (tripId) => { try { const response = await api.post("/tripshare", { tripId }); const url = `${window.location.origin}${response.data.shareUrl}`; await navigator.clipboard?.writeText(url); setMessage("Trip sharing link created and copied."); } catch (err) { setError(err.response?.data?.message || "Unable to create trip share link."); } };

  const activeTrip = useMemo(() => trips.find((trip) => trip.status === "Destination Reached") || trips.find((trip) => !["Completed", "Cancelled"].includes(trip.status)), [trips]);
  const activeTripId = activeTrip?._id;
  const activeTripStatus = activeTrip?.status;
  const finalFareTrip = activeTripStatus === "Destination Reached" ? activeTrip : null;
  const finalFareTripId = finalFareTrip?._id;
  const finalFarePayment = finalFareTripId ? payments.find((payment) => String(payment.trip?._id || payment.trip) === String(finalFareTripId)) : null;
  const finalFareAmount = finalFareTrip ? Number(finalFareTrip.finalFare > 0 ? finalFareTrip.finalFare : finalFareTrip.estimatedFare || finalFareTrip.booking?.estimatedFare || 0) : 0;

  useEffect(() => {
    if (!finalFareTripId) {
      setFareModalOpen(false);
      return undefined;
    }
    if (dismissedFareTripId !== finalFareTripId) setFareModalOpen(true);
    loadFinance();
    const timer = window.setInterval(loadFinance, 5000);
    return () => window.clearInterval(timer);
  }, [finalFareTripId, dismissedFareTripId, loadFinance]);

  useEffect(() => {
    if (finalFarePayment?.method && finalFarePayment.status === "Pending") {
      setPaymentMethod(finalFarePayment.method);
    }
  }, [finalFarePayment?.method, finalFarePayment?.status]);

  useEffect(() => {
    // The six-digit code is available to the customer only while the assigned
    // trip is waiting for pickup verification. The backend consumes it once used.
    if (!activeTripId || activeTripStatus !== "Scheduled") { setPickupOtp(null); return undefined; }
    let alive = true;
    const fetchOtp = async () => {
      try {
        const response = await api.get(`/trips/${activeTripId}/pickup-otp`);
        if (alive) setPickupOtp(response.data || null);
      } catch {
        // A 404 simply means the driver hasn't generated the OTP yet; keep polling.
        if (alive) setPickupOtp(null);
      }
    };
    fetchOtp();
    const timer = window.setInterval(fetchOtp, 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [activeTripId, activeTripStatus]);

  const tabs = [["book", "Book a ride"], ["history", "Trips"], ["payments", "Payments"], ["support", "Support"], ["safety", "Safety"]];

  return (
    <main className="dashboard-page customer-dashboard">
      <header className="dashboard-header">
        <div><span className="section-label">CUSTOMER SPACE</span><h1>Hello, {user?.name || "Travels"}.</h1><p>Book a ride, follow your trip and keep your travel history together.</p></div>
        <div className="customer-account">
          <div className="customer-account-avatar" aria-hidden="true">👤</div>
          <div className="customer-account-info"><strong>{user?.name || "Travels Customer"}</strong><span>{user?.email || "Signed in customer"}</span></div>
          <button className="dashboard-logout" onClick={logout}><LogOut size={16} /> Logout</button>
        </div>
      </header>
      {loading && (
        <div className="travels-loading-card">
          <img src={loadingGif} alt="Travels loading" />
          <div><strong>Preparing your travel space</strong><span>Loading your rides, vehicles and travel details…</span></div>
        </div>
      )}
      <nav className="dashboard-tabs">{tabs.map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => { setTab(key); setMessage(""); setError(""); }}>{label}{key === "history" && bookings.length ? ` (${bookings.length})` : ""}</button>)}</nav>
      {message && <div className="dashboard-alert success">{message}</div>}{error && <div className="dashboard-alert error">{error}</div>}

      {tab === "book" && <div className="customer-layout">
        <section className="dashboard-card"><div className="card-heading"><div><span className="section-label">NEW BOOKING</span><h2>Book your next ride</h2></div><span className="secure-badge"><ShieldAlert size={14} /> Secure</span></div>
          <form onSubmit={submitBooking} className="booking-form-grid">
            <label>Trip type<select value={form.tripType} onChange={(e) => update("tripType", e.target.value)}>{bookingTypes.map(([label, value]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="vehicle-category-field">Vehicle category<select value={form.vehicleCategory} onChange={(e) => update("vehicleCategory", e.target.value)} required><option value="">Select vehicle</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name} · {category.seatingCapacity} seats{category._id === form.vehicleCategory && fare ? ` · ₹${Number(fare.finalFare || 0).toLocaleString("en-IN")}` : ""}</option>)}</select></label>
            <div className="wide"><ExactLocationPicker label="Pickup location" placeholder="Search exact pickup location" value={form.pickupLocation} selectedPlace={form.pickupPlace} onChange={(value) => update("pickupLocation", value)} onSelect={(place) => update("pickupPlace", place)} /></div>
            <div className="wide"><ExactLocationPicker label="Drop location" placeholder="Search exact destination" value={form.dropLocation} selectedPlace={form.dropPlace} onChange={(value) => update("dropLocation", value)} onSelect={(place) => update("dropPlace", place)} /></div>
            <label className="wide" style={{display:"flex",alignItems:"center",gap:"10px",flexDirection:"row"}}><input type="checkbox" checked={bookForOther} onChange={(e)=>setBookForOther(e.target.checked)} /> Book for someone else</label>
            {bookForOther && <><label>Passenger name<input value={passengerName} onChange={(e)=>setPassengerName(e.target.value)} placeholder="Passenger full name" required /></label><label>Passenger phone<input value={passengerPhone} onChange={(e)=>setPassengerPhone(e.target.value)} placeholder="Passenger phone" required /></label></>}
            <label>Travel date<div className="input-with-icon picker-field"><CalendarDays size={16} /><input type="date" value={form.travelDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => update("travelDate", e.target.value)} onClick={(e) => e.currentTarget.showPicker?.()} required /></div></label>
            <label>Travel time<div className="input-with-icon picker-field"><Clock3 size={16} /><input type="time" value={form.travelTime} onChange={(e) => update("travelTime", e.target.value)} onClick={(e) => e.currentTarget.showPicker?.()} required /></div></label>
            <label>Passengers<select value={form.passengerCount} onChange={(e) => update("passengerCount", e.target.value)}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
            <div className="route-summary-field"><span>Road distance</span><strong>{routeLoading ? "Calculating…" : route ? `${route.distanceKmExact} km` : "Select locations"}</strong><small>{route ? `${route.durationMinutes} min driving` : "Road distance calculated automatically"}</small></div>
            {fare && (
              <div className="wide my-3">
                <RedTaxiFareBreakdown fare={fare} distanceKm={route?.distanceKmExact} vehicleCategory={categories.find((c) => c._id === form.vehicleCategory)?.name} promoApplied={Boolean(form.couponCode)} />
              </div>
            )}
            {form.tripType === "hourly" && <label>Hours<select value={form.durationHours} onChange={(e) => update("durationHours", e.target.value)}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} hour{i ? "s" : ""}</option>)}</select></label>}
            <label>Coupon code<input value={form.couponCode} onChange={(e) => update("couponCode", e.target.value.toUpperCase())} placeholder="Optional" /></label>
            <label className="wide">Special requirements<textarea value={form.specialRequirements} onChange={(e) => update("specialRequirements", e.target.value)} placeholder="Optional notes for the travel team" rows="3" /></label>
            <div className="wide journey-preview-card">
              <div className="journey-preview-head"><div><span className="section-label">JOURNEY PREVIEW</span><h3>Everything is ready for your ride</h3></div><span className="journey-live-badge"><i /> Smart booking</span></div>
              <div className="journey-preview-track">
                <div className="journey-preview-stop pickup"><span className="journey-dot">1</span><div><small>PICKUP</small><strong>{form.pickupLocation || "Choose pickup location"}</strong><em>Exact pickup point</em></div></div>
                <div className="journey-preview-line"><i /></div>
                <div className="journey-preview-stop destination"><span className="journey-dot">2</span><div><small>DESTINATION</small><strong>{form.dropLocation || "Choose destination"}</strong><em>Your final stop</em></div></div>
              </div>
              <div className="journey-preview-metrics">
                <div><span>ROAD DISTANCE</span><strong>{routeLoading ? "Calculating…" : route ? `${route.distanceKmExact} km` : "—"}</strong></div>
                <div><span>DRIVING TIME</span><strong>{route ? `${route.durationMinutes} min` : "—"}</strong></div>
                <div><span>FARE ENGINE</span><strong>{fare ? "Ready" : "Waiting"}</strong></div>
                <div><span>DISPATCH</span><strong>Nearby drivers</strong></div>
              </div>
            </div>
            <button className="dashboard-primary wide" type="submit" disabled={submitting || loading || routeLoading}>{submitting ? "Finding your ride…" : "Confirm booking"}</button>
          </form>
        </section>
      </div>}

      {tab === "history" && <section className="dashboard-card trip-history-card"><div className="card-heading"><div><span className="section-label">YOUR TRIPS</span><h2>Booking & trip history</h2><p className="trip-history-subtitle">Track your rides, follow live dispatch and keep every journey in one place.</p></div><button className="icon-button" onClick={loadCore} title="Refresh"><RefreshCw size={16} /></button></div>
      {(activeTrip || bookings[0]) && (
        <RedTaxiDispatchTracker trip={activeTrip} booking={bookings.find(b => !["Completed", "Cancelled"].includes(b.status)) || bookings[0]} pickupOtp={pickupOtp} onSosTrigger={triggerSOS} />
      )}<div className="booking-list">{bookings.map((booking) => <article className="booking-row" key={booking._id}><div><strong>{booking.bookingId || booking._id.slice(-6).toUpperCase()}</strong><span>{booking.pickupLocation} → {booking.dropLocation}</span><small>{booking.travelDate} · {booking.travelTime} · {booking.status === "Pending" ? "Searching for nearby driver…" : booking.status}</small></div><div className="booking-row-side"><strong>₹{Number(booking.estimatedFare || 0).toLocaleString("en-IN")}</strong>{cancellable.includes(booking.status) && <button className="text-button" onClick={() => cancelBooking(booking._id)}>Cancel</button>}</div></article>)}</div>{trips.map((trip) => {
          if (trip.status !== "Completed") return null;
          const driverName = trip.driver?.name || trip.driver?.user?.name || "Driver";
          const existing = rating[trip._id]?.existing;
          const score = Number(existing?.rating || rating[trip._id]?.score || 0);
          return (
            <article className="trip-completion enhanced-trip-rating" key={trip._id}>
              <div className="trip-driver-summary">
                <div className="driver-avatar">👤</div>
                <div><span className="section-label">DRIVER</span><strong>{driverName}</strong><p>{trip.booking?.bookingId || "Completed trip"} · Trip completed</p></div>
              </div>
              <div className="trip-rating-area">
                <div className="rating-title">{existing ? "Your rating" : "Rate your driver"}</div>
                <div className="rating-control" aria-label="Driver rating">{[1,2,3,4,5].map((star) => <button key={star} type="button" className={score >= star ? "selected" : ""} disabled={Boolean(existing)} onClick={() => setRating((r) => ({ ...r, [trip._id]: { ...r[trip._id], score: star } }))}><Star size={18} fill="currentColor" /></button>)}</div>
                {existing ? <span className="rating-saved">⭐ {existing.rating}/5 · Thank you for rating</span> : <div className="rating-actions"><input value={rating[trip._id]?.review || ""} onChange={(e) => setRating((r) => ({ ...r, [trip._id]: { ...r[trip._id], review: e.target.value } }))} placeholder="Optional review" maxLength={1000} /><button className="dashboard-primary compact" onClick={() => rateTrip(trip._id)} disabled={ratingLoading}>Submit rating</button></div>}
                <button className="text-button" onClick={() => shareTrip(trip._id)}><Share2 size={14} /> Share trip</button>
              </div>
            </article>
          );
        })}</section>}

      {tab === "payments" && <section className="dashboard-card"><div className="card-heading"><div><span className="section-label">PAYMENTS & INVOICES</span><h2>Travel payments</h2></div><Wallet size={20} /></div><div className="payment-actions">{trips.filter((trip) => trip.status === "Destination Reached").map((trip) => <div className="payment-card" key={trip._id}><div><strong>{trip.booking?.bookingId || "Completed trip"}</strong><span>₹{Number(trip.finalFare || trip.estimatedFare || 0).toLocaleString("en-IN")}</span></div><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option>Cash</option><option>UPI</option><option>Card</option><option>Wallet</option></select><button className="dashboard-primary compact" onClick={() => createPayment(trip._id)}>Pay now</button></div>)}</div><h3 className="subheading">Payment history</h3><div className="booking-list">{payments.map((payment) => <article className="booking-row" key={payment._id}><div><strong>{payment.paymentId || payment._id.slice(-8)}</strong><span>{payment.method}</span></div><div className="booking-row-side"><strong>₹{Number(payment.amount || 0).toLocaleString("en-IN")}</strong><small>{payment.status}</small></div></article>)}</div><h3 className="subheading">Invoices</h3><div className="booking-list">{invoices.map((invoice) => <article className="booking-row" key={invoice._id}><div><strong>{invoice.invoiceNumber || invoice._id}</strong><span>Digital invoice</span></div><div className="booking-row-side"><strong>₹{Number(invoice.totalAmount || invoice.amount || 0).toLocaleString("en-IN")}</strong><button className="text-button" onClick={() => downloadInvoice(invoice)}>Download</button></div></article>)}</div></section>}

      {tab === "support" && <section className="support-grid"><div className="dashboard-card"><div className="card-heading"><div><span className="section-label">SUPPORT</span><h2>Need help?</h2></div><MessageCircle size={20} /></div><textarea rows="6" value={supportText} onChange={(e) => setSupportText(e.target.value)} placeholder="Tell the travel team what happened..." /><button className="dashboard-primary" onClick={createTicket}><Send size={16} /> Create ticket</button></div><div className="dashboard-card"><div className="card-heading"><h2>Your tickets</h2></div>{tickets.length ? tickets.map((ticket) => <article className="support-item" key={ticket._id}><strong>{ticket.subject}</strong><span>{ticket.status}</span><p>{ticket.description}</p></article>) : <p className="empty-state">No support tickets.</p>}</div></section>}

      {finalFareTrip && fareModalOpen && <div className="modal-backdrop final-fare-backdrop" role="dialog" aria-modal="true" aria-labelledby="final-fare-title">
        <section className="modal-card final-fare-modal">
          <button className="modal-close" aria-label="Close fare summary" onClick={() => { setFareModalOpen(false); setDismissedFareTripId(finalFareTrip._id); }}><X size={17} /></button>
          <span className="section-label">TRIP FARE FINALIZED</span>
          <h2 id="final-fare-title">Your ride has reached its destination</h2>
          <p className="muted-text">Review the final system fare below. Your driver must verify the payment status before the trip is marked completed.</p>
          <div className="final-fare-total"><div><span>Total amount payable</span><strong>₹{finalFareAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></div><Receipt size={28} /></div>
          <div className="modal-grid final-fare-details">
            <div><span>Pickup</span><strong>{finalFareTrip.booking?.pickupLocation || finalFareTrip.pickupLocation || "Pickup location"}</strong></div>
            <div><span>Destination</span><strong>{finalFareTrip.booking?.dropLocation || finalFareTrip.dropLocation || "Destination"}</strong></div>
          </div>
          <label className="final-fare-payment-label">Payment method
            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} disabled={finalFarePayment?.status === "Paid"}>
              <option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Card">Card</option><option value="Wallet">Wallet</option>
            </select>
          </label>
          <div className={`final-fare-payment-status ${finalFarePayment?.status === "Paid" ? "is-paid" : "is-pending"}`}>
            {finalFarePayment?.status === "Paid" ? <CheckCircle2 size={19} /> : <CreditCard size={19} />}
            <div><strong>{!finalFarePayment ? "Payment not started" : finalFarePayment.status === "Paid" ? "Payment recorded as PAID" : finalFarePayment.status === "Failed" ? "Payment attempt failed" : "Payment awaiting confirmation"}</strong>
              <span>{!finalFarePayment ? "Choose a payment method to register the fare." : finalFarePayment.status === "Paid" ? "Your driver must verify this status before completing the trip." : finalFarePayment.method === "Cash" ? "Please give the exact displayed fare to your driver. The driver will confirm receipt." : "Complete the online payment, then the driver will verify its recorded status."}</span>
            </div>
          </div>
          {finalFarePayment?.status !== "Paid" && <button className="dashboard-primary final-fare-action" onClick={() => createPayment(finalFareTrip._id)} disabled={paymentSubmitting || (finalFarePayment?.status === "Pending" && finalFarePayment.method === "Cash" && paymentMethod === "Cash")}>
            <CreditCard size={17} />{paymentSubmitting ? "Processing…" : finalFarePayment?.status === "Pending" && finalFarePayment.method === "Cash" && paymentMethod === "Cash" ? "Pay your driver in cash" : paymentMethod === "Cash" ? "Confirm cash payment method" : `Pay ₹${finalFareAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })} with ${paymentMethod}`}
          </button>}
          {finalFarePayment?.status === "Paid" && <p className="final-fare-waiting"><CheckCircle2 size={16} /> Waiting for your driver to verify payment status.</p>}
          <button className="text-button final-fare-close" onClick={() => { setFareModalOpen(false); setDismissedFareTripId(finalFareTrip._id); }}>Close fare summary</button>
        </section>
      </div>}

      {submitting && <div className="booking-loading-overlay" role="status" aria-live="polite"><div className="booking-loading-modal"><img src={loadingGif} alt="" /><span className="section-label">TRAVELS</span><h2>Finding your ride</h2><p>Confirming your booking and preparing the next step of your journey…</p></div></div>}

      {tab === "safety" && <section className="support-grid"><div className="dashboard-card sos-card"><ShieldAlert size={28} /><h2>Emergency assistance</h2><p>Use SOS only when you need urgent travel assistance.</p><textarea rows="3" value={sosText} onChange={(e) => setSosText(e.target.value)} placeholder="Optional message" /><button className="danger-button" onClick={triggerSOS}>Send SOS</button></div><div className="dashboard-card"><h2>Trip safety</h2><div className="safety-list"><div><Phone size={17} /><span>Masked communication</span></div><div><Navigation size={17} /><span>Live trip tracking</span></div><div><Share2 size={17} /><span>Share trip with someone you trust</span></div><div><ShieldAlert size={17} /><span>Emergency operations support</span></div></div></div></section>}
    </main>
  );
};
export default CustomerDashboard;
