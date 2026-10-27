import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Banknote, BellRing, CarFront, CheckCircle2, Clock3, LogOut, MapPin, Navigation, Receipt, RefreshCw, Send, ShieldAlert, Star, UserRound, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { connectDispatchSocket } from "../../services/socket";

const DriverDashboard = () => {
  const { user, logout } = useAuth();
  const [trips, setTrips] = useState([]);
  const [availability, setAvailability] = useState("Available");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [locationSharing, setLocationSharing] = useState(false);
  const [ticketText, setTicketText] = useState("");
  const [rideOffer, setRideOffer] = useState(null);
  const [offerSeconds, setOfferSeconds] = useState(0);
  const [offerLoading, setOfferLoading] = useState(false);
  const offerRequestInFlight = useRef(false);
  const offerPollTimer = useRef(null);
  const offerFailureCount = useRef(0);
  const [otpTrip, setOtpTrip] = useState(null);
  const [otpValue, setOtpValue] = useState("");
  const [cashPayments, setCashPayments] = useState({});
  const [reliability, setReliability] = useState(null);
  const [rewards, setRewards] = useState(null);
  const [paymentConfirmModal, setPaymentConfirmModal] = useState(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const dismissedPaymentModalId = useRef(null);
  const tripsRef = useRef(trips);
  tripsRef.current = trips;

  const loadOffer = useCallback(async () => {
    // Never allow overlapping offer requests. On slower hosting, the previous
    // 1-second interval could create concurrent requests whose responses
    // arrived out of order and hid a real ride offer.
    if (offerRequestInFlight.current) return false;
    offerRequestInFlight.current = true;
    try {
      const response = await api.get("/dispatch/driver/current", { timeout: 8000 });
      const nextOffer = response.data.offer || null;
      offerFailureCount.current = 0;
      setRideOffer(nextOffer);
      setError((current) => current === "Unable to load ride requests." ? "" : current);
      return Boolean(nextOffer);
    } catch (err) {
      offerFailureCount.current += 1;
      // Do not flash a dashboard error for one transient request failure.
      // Show it only after repeated failures so a delayed Render/Mongo request
      // cannot make a valid ride popup appear to be missing.
      if (offerFailureCount.current >= 3) {
        const message = err.response?.data?.message || "Unable to load ride requests.";
        setError((current) => current === message ? current : message);
      }
      return false;
    } finally {
      offerRequestInFlight.current = false;
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        api.get("/trips/driver/my"),
        api.get("/driver-location/my"),
        api.get("/drivers/me"),
        api.get("/rideguard/reliability/me"),
        api.get("/rideguard/rewards/me"),
      ]);

      const [tripsResult, locationResult, profileResult] = results;
      const failures = [];

      if (tripsResult.status === "fulfilled") {
        setTrips(tripsResult.value.data.trips || []);
      } else {
        failures.push(tripsResult.reason?.response?.data?.message || "Unable to load assigned trips.");
      }

      if (locationResult.status === "fulfilled") {
        setLocationSharing(Boolean(locationResult.value.data.location?.isActive));
      }

      if (profileResult.status === "fulfilled") {
        const mine = profileResult.value.data.driver || null;
        setAvailability(mine?.status || "Available");
      } else {
        failures.push(profileResult.reason?.response?.data?.message || "Unable to load driver profile.");
      }

      const reliabilityResult = results[3];
      if (reliabilityResult.status === "fulfilled") { setReliability(reliabilityResult.value.data); }
      const rewardsResult = results[4];
      if (rewardsResult.status === "fulfilled") { setRewards(rewardsResult.value.data.rewards || null); }

      if (failures.length) setError(failures.join(" "));
      else setError("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const playOfferChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    } catch { /* audio context policy safe */ }
  }, []);

  const refreshPaymentStatuses = useCallback(async () => {
    const destinationTrips = trips.filter((trip) => trip.status === "Destination Reached");
    if (!destinationTrips.length) return;
    const results = await Promise.allSettled(destinationTrips.map(async (trip) => {
      const response = await api.get(`/payments/driver/trip/${trip._id}`);
      return [trip._id, response.data.payment || null];
    }));
    setCashPayments((current) => {
      const next = { ...current };
      results.forEach((result) => {
        if (result.status === "fulfilled") next[result.value[0]] = result.value[1];
      });
      return next;
    });
  }, [trips]);

  useEffect(() => {
    if (!trips.some((trip) => trip.status === "Destination Reached")) return undefined;
    refreshPaymentStatuses();
    const timer = window.setInterval(refreshPaymentStatuses, 2000);
    return () => window.clearInterval(timer);
  }, [refreshPaymentStatuses, trips]);

  useEffect(() => {
    let cancelled = false;
    const socket = connectDispatchSocket();
    const handleOffer = (payload) => {
      if (cancelled || !payload?.offer) return;
      setRideOffer(payload.offer);
      setOfferSeconds(Math.max(0, Math.ceil((new Date(payload.offer.expiresAt).getTime() - Date.now()) / 1000)));
      offerFailureCount.current = 0;
      playOfferChime();
    };

    const handleOfferExpired = (payload) => {
      if (cancelled) return;
      setRideOffer((current) => (current?._id === payload?.offerId ? null : current));
      loadOffer();
    };

    const handlePaymentUpdated = (payload) => {
      if (cancelled || !payload?.tripId) return;
      if (payload.payment) {
        setCashPayments((current) => ({ ...current, [payload.tripId]: payload.payment }));
        setMessage(`Payment updated by customer: ${payload.payment.method} · ${payload.payment.status}`);
      }
      refreshPaymentStatuses();
    };

    const handleBookingCancelled = (payload) => {
      if (cancelled) return;
      setMessage("Ride cancelled by passenger.");
      setRideOffer(null);
      load();
    };

    const handleTripStatus = () => {
      if (cancelled) return;
      load();
    };

    socket?.on("dispatch:offer", handleOffer);
    socket?.on("dispatch:expired", handleOfferExpired);
    socket?.on("payment:updated", handlePaymentUpdated);
    socket?.on("booking:cancelled", handleBookingCancelled);
    socket?.on("trip:status", handleTripStatus);

    // REST remains a fast recovery path for cold starts and reconnects
    const poll = async () => {
      if (cancelled || rideOffer) return;
      const found = await loadOffer();
      if (!cancelled && !found && !rideOffer) offerPollTimer.current = window.setTimeout(poll, 800);
    };
    poll();
    const refresh = () => { if (!rideOffer) poll(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      socket?.off("dispatch:offer", handleOffer);
      socket?.off("dispatch:expired", handleOfferExpired);
      socket?.off("payment:updated", handlePaymentUpdated);
      socket?.off("booking:cancelled", handleBookingCancelled);
      socket?.off("trip:status", handleTripStatus);
      if (offerPollTimer.current) window.clearTimeout(offerPollTimer.current);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadOffer, rideOffer, playOfferChime, refreshPaymentStatuses, load]);

  useEffect(() => {
    if (!rideOffer?.expiresAt) { setOfferSeconds(0); return undefined; }
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((new Date(rideOffer.expiresAt).getTime() - Date.now()) / 1000));
      setOfferSeconds(seconds);
      if (seconds === 0) {
        // Clear the expired popup immediately, then ask the server for the next
        // offer. This prevents a stale modal from blocking the next request.
        setRideOffer(null);
        window.setTimeout(loadOffer, 50);
      }
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [rideOffer, loadOffer]);

  const respondToOffer = async (action) => {
    if (!rideOffer) return;
    setOfferLoading(true);
    try {
      if (action === "accept") {
        await api.post(`/dispatch/driver/${rideOffer._id}/accept`);
        setMessage("Ride accepted. The trip is now assigned to you.");
      } else {
        await api.post(`/dispatch/driver/${rideOffer._id}/decline`, { reason: "Driver declined the ride request" });
        setMessage("Ride declined. The system is contacting the next nearby driver.");
      }
      setRideOffer(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to respond to the ride request.");
      await loadOffer();
    } finally { setOfferLoading(false); }
  };

  const setStatus = async (tripId, status) => {
    try {
      if (status === "Started") {
        await api.post(`/trips/${tripId}/pickup-otp`);
        setMessage("The 6-digit OTP is now available in the customer's Travels app. Ask the customer to read it to you.");
        setOtpValue("");
        setOtpTrip(trips.find((item) => item._id === tripId) || { _id: tripId });
        await load();
        return;
      }
      if (status === "Completed") { setError("Trip completion is automatic after payment confirmation."); return; }
      await api.patch(`/trips/${tripId}/status`, { status }); setMessage(`Trip updated to ${status}.`); await load();
    } catch (err) { setError(err.response?.data?.message || "Unable to update trip status."); }
  };

  const verifyOtp = async () => { if(!otpTrip || !/^\d{6}$/.test(otpValue)) return setError("Enter the 6-digit pickup OTP."); try { await api.post(`/trips/${otpTrip._id}/verify-pickup-otp`, {otp:otpValue}); setMessage("OTP verified. Trip started and GPS tracking can now begin."); setOtpTrip(null); setOtpValue(""); await load(); } catch(err){ setError(err.response?.data?.message || "OTP verification failed."); } };
  const cancelDriverTrip = async (tripId) => { if(!window.confirm("Cancel this assignment and let the system find another driver?")) return; try { await api.post(`/trips/${tripId}/driver-cancel`, {reason:"Driver cancelled before pickup"}); setMessage("Assignment cancelled. Searching for another nearby driver."); await load(); } catch(err){ setError(err.response?.data?.message || "Unable to cancel trip."); } };
  const confirmPaymentStatus = async (tripId) => {
    try {
      // Always fetch a fresh server status before the driver confirms it.
      const response = await api.get(`/payments/driver/trip/${tripId}`);
      const payment = response.data.payment;
      if (payment) setCashPayments((current) => ({ ...current, [tripId]: payment }));
      if (!payment) {
        setError("No payment record exists yet. Ask the customer to select a payment method in the fare popup.");
        return;
      }
      if (payment.status !== "Paid" && payment.method !== "Cash") {
        setError("The online payment is still pending. Ask the customer to finish payment, then refresh the status.");
        return;
      }
      const amount = Number(payment.amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
      const prompt = payment.method === "Cash" && payment.status !== "Paid"
        ? `Confirm that you actually received ₹${amount} in cash from the customer. The trip will be completed after confirmation.`
        : `The system records this ${payment.method} payment as ${payment.status}. Have you checked and confirmed the payment status? The trip will be completed after confirmation.`;
      setPaymentConfirmModal({
        paymentId: payment._id,
        amount,
        method: payment.method,
        status: payment.status,
        prompt,
      });
      return;
      setMessage(`Payment status verified (${payment.method}). Trip completed and invoice generated.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to verify payment status.");
      await refreshPaymentStatuses();
    }
  };

  const completePaymentConfirmation = async () => {
    if (!paymentConfirmModal?.paymentId || confirmSubmitting) return;
    try {
      setConfirmSubmitting(true);
      await api.patch(`/payments/${paymentConfirmModal.paymentId}/driver-confirm`);
      setPaymentConfirmModal(null);
      setMessage(`Payment status verified (${paymentConfirmModal.method}). Trip completed and invoice generated.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to verify payment status.");
      await refreshPaymentStatuses();
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const updateAvailability = async (status) => {
    try {
      await api.patch("/drivers/me/status", { status });
      setAvailability(status);
      setMessage(`Availability changed to ${status}.`);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update availability.");
    }
  };

  useEffect(() => {
    if (!locationSharing) return undefined;
    let active = true;
    const sendLocation = async () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(async (position) => {
        if (!active) return;
        const trip = trips.find((item) => ["Scheduled", "Started", "Customer Picked Up", "Ongoing"].includes(item.status));
        try { await api.post("/driver-location/update", { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, heading: position.coords.heading, speed: position.coords.speed, tripId: trip?._id }); } catch { /* background location failure should not interrupt trip controls */ }
      }, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 });
    };
    sendLocation();
    const interval = window.setInterval(sendLocation, 10000);
    return () => { active = false; window.clearInterval(interval); };
  }, [locationSharing, trips]);

  const toggleLocation = async () => {
    try {
      if (locationSharing) { await api.patch("/driver-location/stop"); setLocationSharing(false); setMessage("Location sharing stopped."); }
      else { setLocationSharing(true); setMessage("Location sharing enabled. GPS will update every 10 seconds during active trips."); }
    } catch (err) { setError(err.response?.data?.message || "Unable to change location sharing."); }
  };

  const sendTicket = async () => { if (!ticketText.trim()) return; try { await api.post("/support", { subject: "Driver support", description: ticketText.trim() }); setTicketText(""); setMessage("Support ticket sent."); } catch (err) { setError(err.response?.data?.message || "Unable to create support ticket."); } };
  const sendSOS = async () => { try { await api.post("/SOS", { message: "Driver emergency assistance requested" }); setMessage("SOS alert sent."); } catch (err) { setError(err.response?.data?.message || "Unable to send SOS."); } };

  return (
    <main className="dashboard-page">
      <header className="dashboard-header"><div><span className="section-label">DRIVER SPACE</span><h1>Welcome, {user?.name || "Driver"}.</h1><p>Manage availability, assigned trips and live location.</p></div><button className="dashboard-logout" onClick={logout}><LogOut size={16} /> Logout</button></header>
      {message && <div className="dashboard-alert success">{message}</div>}{error && <div className="dashboard-alert error">{error}</div>}
      {rideOffer && <div className="booking-loading-overlay driver-dispatch-overlay" role="dialog" aria-modal="true" aria-labelledby="driver-ride-offer-title">
        <section className="dashboard-card driver-ride-offer driver-ride-offer-modal" style={{ border: "1px solid rgba(196, 160, 82, .65)", boxShadow: "0 28px 90px rgba(0,0,0,.22)" }}>
          <div className="card-heading"><div><span className="section-label">NEW RIDE REQUEST</span><h2 id="driver-ride-offer-title">{rideOffer.booking?.bookingId || "Ride request"}</h2></div><BellRing size={21} /></div>
          <p className="muted-text">Accept or decline before the timer ends. If you do not respond, the request automatically moves to another nearby driver.</p>
          <div className="driver-trip-head" style={{ marginTop: "14px" }}><div><strong>{rideOffer.booking?.pickupLocation}</strong><span>→ {rideOffer.booking?.dropLocation}</span></div><span className="status-pill">{offerSeconds}s</span></div>
          <div className="trip-details" style={{ marginTop: "14px" }}><div><MapPin size={15} /><span>Pickup</span><strong>{rideOffer.booking?.pickupLocation}</strong></div><div><Navigation size={15} /><span>Destination</span><strong>{rideOffer.booking?.dropLocation}</strong></div><div><UserRound size={15} /><span>Passengers</span><strong>{rideOffer.booking?.passengerCount || 1}</strong></div><div><Clock3 size={15} /><span>Travel</span><strong>{rideOffer.booking?.travelDate ? new Date(rideOffer.booking.travelDate).toLocaleDateString("en-IN") : "As requested"} · {rideOffer.booking?.travelTime || "Time not set"}</strong></div></div>
          <div className="driver-trip-actions" style={{ marginTop: "16px", display: "flex", gap: "10px" }}><button className="dashboard-primary compact" disabled={offerLoading || offerSeconds <= 0} onClick={() => respondToOffer("accept")}><CheckCircle2 size={15} /> Accept ride</button><button className="dashboard-primary compact dark-outline" disabled={offerLoading || offerSeconds <= 0} onClick={() => respondToOffer("decline")}>Decline</button></div>
          <p className="muted-text" style={{ marginTop: "12px", textAlign: "center" }}>This request stays on screen until you respond or the timer expires.</p>
        </section>
      </div>}
      <div className="driver-control-grid">
        <section className="dashboard-card"><div className="card-heading"><div><span className="section-label">RIDEGUARD · PHASE 3</span><h2>Reliability & rewards</h2></div><Star size={20} /></div>{reliability ? <div className="trip-details"><div><span>Reliability score</span><strong>{reliability.reliability?.score ?? 70}/100</strong></div><div><span>Average rating</span><strong>{reliability.reliability?.avgRating ?? "—"} ★</strong></div><div><span>Completed</span><strong>{reliability.reliability?.completed ?? 0}</strong></div><div><span>Reward points</span><strong>{reliability.rewardPoints ?? 0}</strong></div></div> : <p className="muted-text">Loading reliability score…</p>}<p className="muted-text" style={{marginTop:"8px"}}>{reliability?.trustedDriver ? "🛡️ Trusted Driver — priority dispatch enabled." : "Complete reliable trips and maintain strong ratings to become a Trusted Driver."}</p></section>
        <section className="dashboard-card"><div className="card-heading"><div><span className="section-label">RIDEGUARD · PHASE 6</span><h2>Rewards wallet</h2></div><Star size={20} /></div>{rewards ? <><div className="trip-details"><div><span>Tier</span><strong>{rewards.tier?.name || "Starter"}</strong></div><div><span>Points</span><strong>{rewards.points || 0}</strong></div><div><span>Next tier</span><strong>{rewards.tier?.next ? `${rewards.tier.next} pts` : "Elite achieved"}</strong></div><div><span>Trusted</span><strong>{rewards.trustedDriver ? "Yes" : "Not yet"}</strong></div></div><p className="muted-text" style={{marginTop:"8px"}}>Earn points for reliable service and maintain strong ratings. Your reward history is recorded for transparency.</p>{rewards.ledger?.length > 0 && <div className="data-table-wrap" style={{marginTop:"12px"}}><table><thead><tr><th>Date</th><th>Points</th><th>Balance</th><th>Reason</th></tr></thead><tbody>{rewards.ledger.slice(0,8).map((item)=><tr key={item._id}><td>{new Date(item.createdAt).toLocaleString("en-IN")}</td><td>{item.points > 0 ? `+${item.points}` : item.points}</td><td>{item.balanceAfter}</td><td>{item.reason}</td></tr>)}</tbody></table></div>}</> : <p className="muted-text">Loading rewards wallet…</p>}</section>
        <section className="dashboard-card"><div className="card-heading"><div><span className="section-label">AVAILABILITY</span><h2>Ready for work?</h2></div><UserRound size={20} /></div><div className="availability-control"><button className={availability === "Available" ? "active" : ""} onClick={() => updateAvailability("Available")} disabled={["Assigned", "On Trip"].includes(availability)}>Available</button><button className={availability === "On Leave" ? "active" : ""} onClick={() => updateAvailability("On Leave")} disabled={["Assigned", "On Trip"].includes(availability)}>On leave</button><span>Status: {availability}</span></div></section>
        <section className="dashboard-card"><div className="card-heading"><div><span className="section-label">LIVE GPS</span><h2>Driver location</h2></div><Navigation size={20} /></div><p className="muted-text">Location updates every 10 seconds while sharing is enabled.</p><button className={`dashboard-primary ${locationSharing ? "dark-outline" : ""}`} onClick={toggleLocation}>{locationSharing ? "Stop location sharing" : "Start location sharing"}</button></section>
      </div>
      <section className="dashboard-card"><div className="card-heading"><div><span className="section-label">ASSIGNED TRIPS</span><h2>Today's work</h2><p className="muted-text" style={{marginTop:"6px"}}>Trips assigned automatically by dispatch appear here.</p></div><button className="icon-button" onClick={load}><RefreshCw size={16} /></button></div>{loading ? <p className="empty-state">Loading trips...</p> : trips.length === 0 ? <p className="empty-state">No assigned trips right now.</p> : <div className="driver-trip-list">{trips.map((trip) => { return <article className="driver-trip-card" key={trip._id}><div className="driver-trip-head"><div><strong>{trip.booking?.bookingId || "Trip"}</strong><span>{trip.booking?.pickupLocation || "Pickup"} → {trip.booking?.dropLocation || "Destination"}</span></div><span className="status-pill">{trip.status}</span></div><div className="trip-details"><div><MapPin size={15} /><span>Pickup</span><strong>{trip.booking?.pickupLocation}</strong></div><div><MapPin size={15} /><span>Drop</span><strong>{trip.booking?.dropLocation}</strong></div><div><CarFront size={15} /><span>Vehicle</span><strong>{trip.vehicle?.vehicleNumber || "Assigned vehicle"}</strong></div><div><Clock3 size={15} /><span>Time</span><strong>{trip.booking?.travelTime || "Scheduled"}</strong></div></div><div className="driver-trip-actions">{trip.status === "Scheduled" && <><button className="dashboard-primary compact" onClick={() => setStatus(trip._id,"Started")}><Navigation size={15} /> Generate pickup OTP</button><button className="dashboard-primary compact dark-outline" onClick={()=>setOtpTrip(trip)}>Enter customer OTP</button><button className="text-button" onClick={()=>cancelDriverTrip(trip._id)}>Cancel & re-dispatch</button></>}{trip.status === "Started" && <button className="dashboard-primary compact" onClick={() => setStatus(trip._id,"Customer Picked Up")}><CheckCircle2 size={15} /> Confirm customer picked up</button>}{trip.status === "Customer Picked Up" && <button className="dashboard-primary compact" onClick={() => setStatus(trip._id,"Ongoing")}>Mark Ongoing</button>}{trip.status === "Ongoing" && <button className="dashboard-primary compact" onClick={() => setStatus(trip._id,"Destination Reached")}><Navigation size={15}/> Destination reached</button>}{trip.status === "Destination Reached" && (() => { const payment = cashPayments[trip._id]; const amount = Number(trip.finalFare > 0 ? trip.finalFare : trip.estimatedFare || trip.booking?.estimatedFare || 0); const canVerify = payment && (payment.status === "Paid" || (payment.method === "Cash" && payment.status === "Pending")); const paymentLabel = payment ? `${payment.method} · ${payment.status}` : "Payment method not selected"; return <div className="driver-payment-verification"><div className="driver-payment-summary"><div><span className="section-label">FINAL FARE</span><strong>₹{amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></div><div><span className="section-label">PAYMENT STATUS</span><strong className={payment?.status === "Paid" ? "payment-status-paid" : "payment-status-pending"}>{paymentLabel}</strong></div></div><button className="dashboard-primary compact" disabled={!canVerify} onClick={() => confirmPaymentStatus(trip._id)}><CheckCircle2 size={15} />{!payment ? "Waiting for customer payment method" : payment.status === "Paid" || (payment.method === "Cash" && payment.status === "Pending") ? "Verify payment status & complete trip" : payment.status === "Failed" ? "Payment failed — retry required" : payment.status === "Refunded" ? "Payment refunded — contact admin" : "Waiting for online payment"}</button><button className="text-button" onClick={refreshPaymentStatuses}>Refresh payment status</button><span className="muted-text">Check the current payment record before completing this trip. The driver must verify every payment method.</span></div>; })()}{["Started", "Customer Picked Up", "Ongoing"].includes(trip.status) && <span className="gps-live"><span /> GPS sharing {locationSharing ? "on" : "off"}</span>}</div></article>; })}</div>}</section>
      {paymentConfirmModal && <div className="driver-payment-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="payment-confirm-title">
        <div className="driver-payment-confirm-modal">
          <button className="driver-payment-modal-close" type="button" aria-label="Close payment confirmation" disabled={confirmSubmitting} onClick={() => setPaymentConfirmModal(null)}>
            <X size={18} />
          </button>
          <div className={`driver-payment-modal-badge-icon ${paymentConfirmModal.method === "Cash" ? "cash" : ""}`}>
            <Banknote size={30} />
          </div>
          <span className={`driver-payment-modal-tag ${paymentConfirmModal.method === "Cash" ? "cash" : "online"}`}>
            {paymentConfirmModal.method === "Cash" ? "Cash payment" : "Online payment"}
          </span>
          <h2 id="payment-confirm-title" className="driver-payment-modal-title">Confirm payment received</h2>
          <p className="driver-payment-modal-sub">{paymentConfirmModal.prompt}</p>
          <div className="driver-payment-amount-box">
            <div className="driver-payment-amount-label">Final fare</div>
            <div className="driver-payment-amount-value">₹{paymentConfirmModal.amount}</div>
            <div className={`driver-payment-method-pill ${paymentConfirmModal.status === "Paid" ? "paid" : "pending"}`}>
              {paymentConfirmModal.method} · {paymentConfirmModal.status}
            </div>
          </div>
          <button className="driver-payment-modal-btn-confirm" type="button" disabled={confirmSubmitting} onClick={completePaymentConfirmation}>
            <CheckCircle2 size={17} /> {confirmSubmitting ? "Completing..." : "Confirm & complete trip"}
          </button>
          <button className="driver-payment-modal-btn-dismiss" type="button" disabled={confirmSubmitting} onClick={() => setPaymentConfirmModal(null)}>
            Cancel
          </button>
        </div>
      </div>}
      {otpTrip && <div className="booking-loading-overlay" role="dialog" aria-modal="true"><div className="booking-loading-modal"><span className="section-label">PICKUP VERIFICATION</span><h2>Enter customer OTP</h2><p>Ask the passenger for the 6-digit OTP shown in their Travels app.</p><input inputMode="numeric" maxLength="6" value={otpValue} onChange={(e)=>setOtpValue(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="6-digit OTP" style={{fontSize:"24px",letterSpacing:"8px",textAlign:"center"}} /><div style={{display:"flex",gap:"10px",marginTop:"12px"}}><button className="dashboard-primary" onClick={verifyOtp}>Verify & start trip</button><button className="dashboard-primary dark-outline" onClick={()=>{setOtpTrip(null);setOtpValue("")}}>Cancel</button></div></div></div>}
      <div className="driver-bottom-grid"><section className="dashboard-card"><div className="card-heading"><h2>Driver support</h2><Send size={18} /></div><textarea rows="4" value={ticketText} onChange={(e) => setTicketText(e.target.value)} placeholder="Describe a vehicle, passenger or trip issue" /><button className="dashboard-primary" onClick={sendTicket}>Send ticket</button></section><section className="dashboard-card sos-card"><ShieldAlert size={25} /><h2>Emergency</h2><p>Send an immediate alert to operations.</p><button className="danger-button" onClick={sendSOS}><AlertTriangle size={16} /> SOS</button></section></div>
    </main>
  );
};
export default DriverDashboard;
