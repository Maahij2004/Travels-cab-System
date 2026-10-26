import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, CreditCard, LogOut, MessageCircle, Navigation, Phone, RefreshCw, Receipt, Send, Share2, ShieldAlert, ShieldCheck, LockKeyhole, Star, Wallet, X, AlertTriangle, Gift } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { connectDispatchSocket } from "../../services/socket";
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
  const [ratingModalTripId, setRatingModalTripId] = useState(null);
  const [vehicleRating, setVehicleRating] = useState({});
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
  const [rideGuardIncidents, setRideGuardIncidents] = useState([]);
  const [rideGuardBookingId, setRideGuardBookingId] = useState("");
  const [rideGuardType, setRideGuardType] = useState("driver_not_moving");
  const [rideGuardDescription, setRideGuardDescription] = useState("");
  const [rideGuardAmount, setRideGuardAmount] = useState("");
  const [rideGuardSubmitting, setRideGuardSubmitting] = useState(false);
  const [paymentProtection, setPaymentProtection] = useState({});
  const [fareTransparency, setFareTransparency] = useState(null);
  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelDetails, setCancelDetails] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const loadCore = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
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
    finally { if (showLoading) setLoading(false); }
  }, []);

  // Keep trip status current in every customer tab so the final-fare popup
  // appears as soon as the driver reaches the destination, not only on History.
  useEffect(() => {
    let alive = true;
    const refreshTripStatus = async () => {
      try {
        const [bookingResponse, tripResponse, paymentsResponse] = await Promise.all([
          api.get("/bookings/my"),
          api.get("/trips/customer/my"),
          api.get("/payments/my"),
        ]);
        if (!alive) return;
        setBookings(bookingResponse.data.bookings || []);
        setTrips(tripResponse.data.trips || []);
        setPayments(paymentsResponse.data.payments || []);
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

  useEffect(() => { loadCore(true); }, [loadCore]);
  useEffect(() => {
    const socket = connectDispatchSocket();
    if (!socket) return undefined;

    const handleDispatchStatus = () => {
      loadCore(false);
    };

    const handleDispatchAccepted = (data) => {
      if (data?.booking) {
        setBookings((current) => [
          data.booking,
          ...current.filter((b) => String(b._id) !== String(data.booking._id)),
        ]);
      }
      if (data?.trip) {
        setTrips((current) => [
          data.trip,
          ...current.filter((t) => String(t._id) !== String(data.trip._id)),
        ]);
      }
      loadCore(false);
    };

    const handleTripOtp = (data) => {
      setPickupOtp(data);
    };

    const handleTripStatus = (data) => {
      if (data?.trip) {
        setTrips((current) => [
          data.trip,
          ...current.filter((t) => String(t._id) !== String(data.trip._id)),
        ]);
      }
      if (data?.status === "Destination Reached") {
        setFareModalOpen(true);
      }
      loadCore(false);
    };

    const handleTripCompleted = (data) => {
      setFareModalOpen(false);
      if (data?.tripId) {
        setRatingModalTripId(data.tripId);
      }
      loadCore(false);
      loadFinance();
    };

    const handlePaymentVerified = () => {
      loadFinance();
      loadCore(false);
    };

    socket.on("dispatch:status", handleDispatchStatus);
    socket.on("dispatch:accepted", handleDispatchAccepted);
    socket.on("trip:otp", handleTripOtp);
    socket.on("trip:status", handleTripStatus);
    socket.on("trip:completed", handleTripCompleted);
    socket.on("payment:verified", handlePaymentVerified);

    return () => {
      socket.off("dispatch:status", handleDispatchStatus);
      socket.off("dispatch:accepted", handleDispatchAccepted);
      socket.off("trip:otp", handleTripOtp);
      socket.off("trip:status", handleTripStatus);
      socket.off("trip:completed", handleTripCompleted);
      socket.off("payment:verified", handlePaymentVerified);
    };
  }, [loadCore, loadFinance]);

  useEffect(() => { if (trips.length) loadTripRatings(trips); }, [trips, loadTripRatings]);

  useEffect(() => {
    if (ratingModalTripId) return;
    const eligibleTrip = trips.find((trip) => {
      if (trip.status !== "Completed") return false;
      const payment = payments.find((item) => String(item.trip?._id || item.trip) === String(trip._id));
      const alreadyRated = Boolean(rating[trip._id]?.existing);
      const alreadySkipped = sessionStorage.getItem(`travels_rating_submitted_${trip._id}`) === "1";
      return payment?.status === "Paid" && !alreadyRated && !alreadySkipped;
    });
    if (eligibleTrip) {
      setRatingModalTripId(eligibleTrip._id);
      setRating((current) => ({ ...current, [eligibleTrip._id]: { ...current[eligibleTrip._id], score: current[eligibleTrip._id]?.score || 0, review: current[eligibleTrip._id]?.review || "" } }));
      setVehicleRating((current) => ({ ...current, [eligibleTrip._id]: current[eligibleTrip._id] || 0 }));
    }
  }, [trips, payments, rating, ratingModalTripId]);
  useEffect(() => { const draft = sessionStorage.getItem("travels_booking_draft"); if (draft) { try { setForm((current) => ({ ...current, ...JSON.parse(draft) })); } catch { sessionStorage.removeItem("travels_booking_draft"); } } }, []);
  const loadPaymentProtection = useCallback(async (tripList = trips) => {
    const eligible = tripList.filter((trip) => ["Destination Reached", "Completed"].includes(trip.status));
    const results = await Promise.all(eligible.slice(0, 10).map(async (trip) => {
      try {
        const response = await api.get(`/rideguard/payment-protection/${trip._id}`);
        return [trip._id, response.data.protection];
      } catch {
        return [trip._id, null];
      }
    }));
    setPaymentProtection((current) => ({ ...current, ...Object.fromEntries(results.filter(([, value]) => value)) }));
  }, [trips]);

  const loadRideGuard = useCallback(async () => {
    try {
      const incidentResponse = await api.get("/rideguard/incidents/my");
      setRideGuardIncidents(incidentResponse.data.incidents || []);
    } catch {
      // Keep the RideGuard page usable even when an older backend is missing an optional endpoint.
      setRideGuardIncidents([]);
    }
    const preferred = bookings.find((b) => !["Completed", "Cancelled"].includes(b.status)) || bookings[0];
    if (preferred?._id) {
      try {
        const fareResponse = await api.get(`/rideguard/fare-transparency/${preferred._id}`);
        setFareTransparency(fareResponse.data.transparency || null);
      } catch {
        setFareTransparency(null);
      }
    } else setFareTransparency(null);
  }, [bookings]);

  const submitRideGuard = async () => {
    if (!rideGuardBookingId) return setError("Select a booking first.");
    if (rideGuardType === "extra_fare" && (!rideGuardAmount || Number(rideGuardAmount) < 0)) return setError("Enter the extra fare amount requested.");
    setRideGuardSubmitting(true);
    try {
      const response = await api.post("/rideguard/incidents", { bookingId: rideGuardBookingId, type: rideGuardType, description: rideGuardDescription, requestedAmount: rideGuardType === "extra_fare" ? Number(rideGuardAmount) : undefined });
      setMessage(response.data.autoRescue ? "RideGuard activated Auto Rescue. We are finding another driver." : "RideGuard report submitted successfully.");
      setRideGuardDescription(""); setRideGuardAmount(""); await loadCore(); await loadRideGuard();
    } catch (err) { setError(err.response?.data?.message || "Unable to submit RideGuard report."); }
    finally { setRideGuardSubmitting(false); }
  };

  useEffect(() => {
    if (tab === "payments") { loadFinance(); loadPaymentProtection(trips); }
    if (tab === "support") loadSupport();
    if (tab === "rideguard") { loadRideGuard(); loadPaymentProtection(trips); }
  }, [tab, loadFinance, loadSupport, loadRideGuard, loadPaymentProtection, trips]);

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
      setMessage(response.data.message || "Booking created successfully."); sessionStorage.removeItem("travels_booking_draft"); setForm((current) => ({ ...initialForm, vehicleCategory: current.vehicleCategory })); await loadCore(false); setTab("history");
    } catch (err) { setError(err.response?.data?.message || "Unable to create booking."); } finally { setSubmitting(false); }
  };

  const openCancelModal = (booking) => { setCancelModalBooking(booking); setCancelReason(""); setCancelDetails(""); setError(""); };
  const closeCancelModal = () => { if (cancelSubmitting) return; setCancelModalBooking(null); setCancelReason(""); setCancelDetails(""); };
  const cancelBooking = async () => {
    if (!cancelModalBooking || !cancelReason) return;
    setCancelSubmitting(true);
    try { const reasonText = cancelDetails.trim() ? `${cancelReason}: ${cancelDetails.trim()}` : cancelReason; await api.patch(`/bookings/${cancelModalBooking._id}/cancel`, { reason: reasonText }); setMessage("Booking cancelled successfully."); setCancelModalBooking(null); await loadCore(); }
    catch (err) { setError(err.response?.data?.message || "Unable to cancel booking."); }
    finally { setCancelSubmitting(false); }
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
    const driverScore = Number(rating[tripId]?.score || 0);
    const vehicleScore = Number(vehicleRating[tripId] || 0);
    if (!driverScore || !vehicleScore) return setError("Please rate both the driver and the vehicle.");
    setRatingLoading(true);
    setError("");
    try {
      const response = await api.post("/ratings", {
        tripId,
        rating: driverScore,
        driverRating: driverScore,
        vehicleRating: vehicleScore,
        review: rating[tripId]?.review || "",
      });
      const existing = response.data.rating || response.data;
      setRating((current) => ({ ...current, [tripId]: { ...current[tripId], existing } }));
      setRatingModalTripId(null);
      sessionStorage.setItem(`travels_rating_submitted_${tripId}`, "1");
      setMessage("Thanks for rating your driver and vehicle.");
    } catch (err) { setError(err.response?.data?.message || "Unable to submit rating."); }
    finally { setRatingLoading(false); }
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
    const timer = window.setInterval(fetchOtp, 2000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [activeTripId, activeTripStatus]);

  const tabs = [["book", "Book a ride"], ["history", "Trips"], ["payments", "Payments"], ["rideguard", "RideGuard 🛡️"], ["support", "Support"], ["safety", "Safety"]];

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
      )}<div className="booking-list">{bookings.map((booking) => <article className="booking-row" key={booking._id}><div><strong>{booking.bookingId || booking._id.slice(-6).toUpperCase()}</strong><span>{booking.pickupLocation} → {booking.dropLocation}</span><small>{booking.travelDate} · {booking.travelTime} · {booking.status === "Pending" ? "Searching for nearby driver…" : booking.status}</small></div><div className="booking-row-side"><strong>₹{Number(booking.estimatedFare || 0).toLocaleString("en-IN")}</strong>{cancellable.includes(booking.status) && <button className="text-button" onClick={() => openCancelModal(booking)}>Cancel</button>}</div></article>)}</div>{trips.map((trip) => {
          if (trip.status !== "Completed") return null;
          const existing = rating[trip._id]?.existing;
          const driverScore = Number(existing?.driverRating || existing?.rating || 0);
          const carScore = Number(existing?.vehicleRating || 0);
          return (
            <article className="trip-completion enhanced-trip-rating" key={trip._id}>
              <div className="trip-driver-summary">
                <div className="driver-avatar">👤</div>
                <div><span className="section-label">COMPLETED RIDE</span><strong>{trip.driver?.name || trip.driver?.user?.name || "Driver"}</strong><p>{trip.booking?.bookingId || "Completed trip"} · Payment successful</p></div>
              </div>
              <div className="trip-rating-area">
                {existing ? <span className="rating-saved">⭐ Driver {driverScore}/5 · 🚕 Vehicle {carScore || "—"}/5 · Thank you for rating</span> : <span className="rating-saved">⭐ Rating popup appears after successful payment</span>}
                <button className="text-button" onClick={() => shareTrip(trip._id)}><Share2 size={14} /> Share trip</button>
              </div>
            </article>
          );
        })}</section>}

      {tab === "payments" && <section className="dashboard-card"><div className="card-heading"><div><span className="section-label">PAYMENTS & INVOICES</span><h2>Travel payments</h2></div><Wallet size={20} /></div><div className="payment-actions">{trips.filter((trip) => trip.status === "Destination Reached").map((trip) => <div className="payment-card" key={trip._id}><div><strong>{trip.booking?.bookingId || "Completed trip"}</strong><span>₹{Number(trip.finalFare || trip.estimatedFare || 0).toLocaleString("en-IN")}</span></div><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option>Cash</option><option>UPI</option><option>Card</option><option>Wallet</option></select><button className="dashboard-primary compact" onClick={() => createPayment(trip._id)}>Pay now</button></div>)}</div><h3 className="subheading">Payment history</h3><div className="booking-list">{payments.map((payment) => <article className="booking-row" key={payment._id}><div><strong>{payment.paymentId || payment._id.slice(-8)}</strong><span>{payment.method}</span></div><div className="booking-row-side"><strong>₹{Number(payment.amount || 0).toLocaleString("en-IN")}</strong><small>{payment.status}</small></div></article>)}</div><h3 className="subheading">Invoices</h3><div className="booking-list">{invoices.map((invoice) => <article className="booking-row" key={invoice._id}><div><strong>{invoice.invoiceNumber || invoice._id}</strong><span>Digital invoice</span></div><div className="booking-row-side"><strong>₹{Number(invoice.totalAmount || invoice.amount || 0).toLocaleString("en-IN")}</strong><button className="text-button" onClick={() => downloadInvoice(invoice)}>Download</button></div></article>)}</div></section>}

      {tab === "rideguard" && <section className="rideguard-page">
        <div className="rideguard-hero"><div className="rideguard-hero-copy"><span className="section-label">RIDEGUARD</span><h2>Your Safe Ride, <em>Our Priority</em></h2><p>Locked fares · Trusted drivers · 24×7 protection</p><span className="protected-pill"><ShieldCheck size={16}/> Protected on every ride</span></div><div className="rideguard-hero-art"><ShieldCheck size={74}/><div className="hero-car">🚕</div></div></div>
        <div className="rideguard-feature-grid">{[[ShieldCheck,"Auto Rescue","If your driver doesn't move or becomes unresponsive, we automatically find another driver.","Phase 1","blue"],[LockKeyhole,"Fare Lock","Your quoted fare is locked at booking. No surprise extra fare without approval.","Phase 2","gold"],[Star,"Reliable Drivers","Trusted drivers with strong ratings and better response history get priority.","Phase 3","green"],[CreditCard,"Payment Protection","Payments are verified before your ride is finalized.","Phase 4","purple"],[AlertTriangle,"Incident Center","Report problems and track resolution with the support team.","Phase 5","red"],[Gift,"Driver Rewards","Good drivers earn reward points for reliable service.","Phase 6","mint"]].map(([Icon,title,text,phase,tone])=><article className={`rideguard-feature-card ${tone}`} key={phase}><div className="feature-icon"><Icon size={22}/></div><h3>{title}</h3><p>{text}</p><span>{phase}</span></article>)}</div>
        <div className="rideguard-main-grid"><div className="dashboard-card rideguard-report-card"><div className="rideguard-card-title"><div><span className="section-label">REPORT AN ISSUE</span><h2>We protect your ride</h2><p>Facing a problem? Tell us once and RideGuard takes action.</p></div><div className="shield-orb"><ShieldCheck size={22}/></div></div><label>Booking<select value={rideGuardBookingId} onChange={(e)=>setRideGuardBookingId(e.target.value)}><option value="">Select booking</option>{bookings.filter((b)=>!['Completed','Cancelled'].includes(b.status)).map((b)=><option key={b._id} value={b._id}>{b.bookingId} · {b.status}</option>)}</select></label><label>What went wrong?<select value={rideGuardType} onChange={(e)=>setRideGuardType(e.target.value)}><option value="driver_not_moving">Driver accepted but not moving</option><option value="driver_asked_cancel">Driver asked me to cancel</option><option value="driver_unresponsive">Driver is unresponsive</option><option value="driver_no_show">Driver did not show up</option><option value="extra_fare">Driver demanded extra fare</option><option value="fare_dispute">Fare dispute</option><option value="payment_refusal">Driver refused/blocked payment</option><option value="other">Other</option></select></label>{rideGuardType === "extra_fare" && <label>Extra amount requested<input type="number" min="0" value={rideGuardAmount} onChange={(e)=>setRideGuardAmount(e.target.value)} placeholder="₹ amount"/></label>}<label>Tell us more <span className="optional-label">(optional)</span><textarea rows="4" value={rideGuardDescription} onChange={(e)=>setRideGuardDescription(e.target.value)} placeholder="Describe what happened…"/></label><button className="rideguard-primary" onClick={submitRideGuard} disabled={rideGuardSubmitting}>{rideGuardSubmitting?"Activating protection…":"Report & protect my ride"}</button></div>
          <div className="rideguard-side-stack"><div className="dashboard-card protection-status-card"><div className="status-card-top"><div><span className="section-label">LIVE PROTECTION STATUS</span><h3>You're protected</h3></div><span className="active-badge">ACTIVE</span></div><div className="status-line"><CheckCircle2 size={17}/> Booking protection enabled</div><div className="status-line"><LockKeyhole size={17}/> Fare locked at booking</div><div className="status-line"><ShieldCheck size={17}/> Auto Rescue available</div></div><div className="dashboard-card fare-protection-card"><div className="status-card-top"><div><span className="section-label">FARE & PAYMENT</span><h3>Protected</h3></div><ShieldCheck size={28}/></div>{bookings.filter((b)=>!['Completed','Cancelled'].includes(b.status)).slice(0,3).map((b)=><div className="compact-protection-row" key={b._id}><div><strong>{b.bookingId}</strong><span>{b.pickupLocation} → {b.dropLocation}</span></div><b>₹{Number(b.lockedFare??b.estimatedFare??0).toLocaleString('en-IN')}</b></div>)}</div></div></div>
        {fareTransparency && <div className="dashboard-card rideguard-ledger-card"><div className="status-card-top"><div><span className="section-label">TRANSPARENT FARE</span><h3>Know exactly what you pay</h3></div><LockKeyhole size={22}/></div><div className="fare-ledger">{[["Original estimate",fareTransparency.originalEstimate],["Locked fare",fareTransparency.lockedFare],["Coupon discount",-Number(fareTransparency.couponDiscount||0)],["Waiting charge",fareTransparency.waitingCharge],["Approved adjustment",fareTransparency.otherApprovedAdjustments]].map(([label,value])=><div key={label}><span>{label}</span><strong>₹{Number(value||0).toLocaleString('en-IN')}</strong></div>)}<div className="fare-ledger-total"><span>Final fare</span><strong>₹{Number(fareTransparency.finalFare||0).toLocaleString('en-IN')}</strong></div></div></div>}
      </section>}
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

      {ratingModalTripId && (() => {
        const trip = trips.find((item) => String(item._id) === String(ratingModalTripId));
        if (!trip) return null;
        const driverName = trip.driver?.name || trip.driver?.user?.name || "Your driver";
        const vehicle = trip.vehicle || {};
        const vehicleName = vehicle.name || `${vehicle.brand || ""} ${vehicle.model || ""}`.trim() || vehicle.vehicleType || "Your vehicle";
        const driverScore = Number(rating[ratingModalTripId]?.score || 0);
        const carScore = Number(vehicleRating[ratingModalTripId] || 0);
        return <div className="modal-backdrop rating-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ride-rating-title">
          <section className="modal-card ride-rating-modal">
            <div className="rating-modal-icon"><Star size={25} fill="currentColor" /></div>
            <span className="section-label">RIDE COMPLETED</span>
            <h2 id="ride-rating-title">How was your ride?</h2>
            <p className="muted-text">Payment successful. Tell us about your driver and vehicle.</p>
            <div className="ride-rating-section">
              <div className="ride-rating-heading"><span>👤 Driver</span><strong>{driverName}</strong></div>
              <div className="popup-rating-stars" aria-label="Rate driver">{[1,2,3,4,5].map((star) => <button key={star} type="button" className={driverScore >= star ? "selected" : ""} aria-label={`${star} star${star > 1 ? "s" : ""}`} onClick={() => setRating((current) => ({ ...current, [ratingModalTripId]: { ...current[ratingModalTripId], score: star } }))}><Star size={30} fill="currentColor" /></button>)}</div>
            </div>
            <div className="ride-rating-section">
              <div className="ride-rating-heading"><span>🚕 Vehicle</span><strong>{vehicleName}{vehicle.vehicleNumber ? ` · ${vehicle.vehicleNumber}` : ""}</strong></div>
              <div className="popup-rating-stars" aria-label="Rate vehicle">{[1,2,3,4,5].map((star) => <button key={star} type="button" className={carScore >= star ? "selected" : ""} aria-label={`${star} star${star > 1 ? "s" : ""}`} onClick={() => setVehicleRating((current) => ({ ...current, [ratingModalTripId]: star }))}><Star size={30} fill="currentColor" /></button>)}</div>
            </div>
            <textarea className="ride-rating-review" rows="3" value={rating[ratingModalTripId]?.review || ""} onChange={(e) => setRating((current) => ({ ...current, [ratingModalTripId]: { ...current[ratingModalTripId], review: e.target.value } }))} placeholder="Optional: tell us what you liked or what we can improve…" maxLength={1000} />
            <button className="dashboard-primary wide rating-submit-button" onClick={() => rateTrip(ratingModalTripId)} disabled={ratingLoading || !driverScore || !carScore}>{ratingLoading ? "Saving your rating…" : "Submit rating"}</button>
            <button className="text-button rating-later-button" onClick={() => { sessionStorage.setItem(`travels_rating_submitted_${ratingModalTripId}`, "1"); setRatingModalTripId(null); }}>Rate later</button>
          </section>
        </div>;
      })()}

      {submitting && <div className="booking-loading-overlay" role="status" aria-live="polite"><div className="booking-loading-modal"><img src={loadingGif} alt="" /><span className="section-label">TRAVELS</span><h2>Finding your ride</h2><p>Confirming your booking and preparing the next step of your journey…</p></div></div>}

      {cancelModalBooking && <div className="cancel-modal-backdrop" role="dialog" aria-modal="true"><div className="cancel-modal"><button className="cancel-modal-close" onClick={closeCancelModal} disabled={cancelSubmitting}><X size={20}/></button><div className="cancel-modal-icon"><X size={25}/></div><span className="section-label">CANCEL BOOKING</span><h2>Why are you cancelling?</h2><p>Please select a reason. This helps us improve your experience and protect future rides.</p><div className="cancel-reason-grid">{["Found another ride","Driver is taking too long","Change in plan","Booked by mistake","Driver not responding","Wrong pickup location","Fare is too high","Other"].map((reason)=><button key={reason} className={`cancel-reason ${cancelReason===reason?"selected":""}`} onClick={()=>setCancelReason(reason)}><span>{reason === "Found another ride" ? "⌛" : reason === "Driver is taking too long" ? "🚕" : reason === "Change in plan" ? "↔" : reason === "Booked by mistake" ? "📅" : reason === "Driver not responding" ? "💬" : reason === "Wrong pickup location" ? "⌖" : reason === "Fare is too high" ? "₹" : "…"}</span>{reason}</button>)}</div><textarea className="cancel-details" value={cancelDetails} onChange={(e)=>setCancelDetails(e.target.value)} placeholder="Tell us more (optional)…" rows="3"/><button className="cancel-confirm-button" disabled={!cancelReason||cancelSubmitting} onClick={cancelBooking}>{cancelSubmitting?"Cancelling…":"Cancel Booking"}</button><button className="cancel-keep-button" disabled={cancelSubmitting} onClick={closeCancelModal}>Keep My Booking</button></div></div>}

      {tab === "safety" && <section className="support-grid"><div className="dashboard-card sos-card"><ShieldAlert size={28} /><h2>Emergency assistance</h2><p>Use SOS only when you need urgent travel assistance.</p><textarea rows="3" value={sosText} onChange={(e) => setSosText(e.target.value)} placeholder="Optional message" /><button className="danger-button" onClick={triggerSOS}>Send SOS</button></div><div className="dashboard-card"><h2>Trip safety</h2><div className="safety-list"><div><Phone size={17} /><span>Masked communication</span></div><div><Navigation size={17} /><span>Live trip tracking</span></div><div><Share2 size={17} /><span>Share trip with someone you trust</span></div><div><ShieldAlert size={17} /><span>Emergency operations support</span></div></div></div></section>}
    </main>
  );
};
export default CustomerDashboard;
