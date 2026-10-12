import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, MapPin, Navigation, Phone, RefreshCw, ShieldAlert, Sparkles, Star, UserCheck } from "lucide-react";

const STEPS = [
  ["Confirmed", "Your request is placed"],
  ["Driver Assigned", "Finding nearest driver"],
  ["En Route", "Driver on the way"],
  ["Trip Started", "Trip in progress"],
  ["Completed", "Trip completed"],
];

const stepIndex = (status) => {
  if (["Completed"].includes(status)) return 4;
  if (["Started", "Customer Picked Up", "Ongoing", "Destination Reached", "In Transit"].includes(status)) return 3;
  if (["Driver Assigned", "Vehicle Assigned", "Trip Scheduled", "Scheduled"].includes(status)) return 1;
  if (["Confirmed", "Pending"].includes(status)) return 0;
  return 0;
};

const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

export default function RedTaxiDispatchTracker({ trip, booking, pickupOtp, onSosTrigger }) {
  const [countdown, setCountdown] = useState(20);
  const [showSosModal, setShowSosModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const activeStatus = trip?.status || booking?.status || "Pending";
  const driver = trip?.driver || trip?.driverId || booking?.driver || booking?.assignedDriverId || null;
  const vehicle = trip?.vehicle || trip?.vehicleId || booking?.vehicle || booking?.assignedVehicleId || null;
  // The customer OTP comes from the protected API response, not a UI fallback.
  // Once successfully verified, the backend consumes it and we show Verified instead.
  const otpCode = typeof pickupOtp === "string" ? pickupOtp : pickupOtp?.otp;
  const otpWasVerified = ["Started", "Customer Picked Up", "Ongoing", "Destination Reached"].includes(activeStatus);
  const otpDisplay = otpCode || (otpWasVerified ? "Verified" : activeStatus === "Scheduled" ? "Waiting…" : "Pending");
  const activeStep = stepIndex(activeStatus);
  const searching = ["Pending", "Confirmed"].includes(activeStatus) && !driver;

  useEffect(() => {
    if (!searching) { setCountdown(20); return undefined; }
    setCountdown(20);
    const interval = window.setInterval(() => setCountdown((value) => (value > 0 ? value - 1 : 0)), 1000);
    return () => window.clearInterval(interval);
  }, [searching, booking?._id]);

  if (!booking && !trip) return null;

  const handleCopyShareLink = async () => {
    const shareUrl = `${window.location.origin}/shared-trip/${trip?._id || booking?._id}`;
    try { await navigator.clipboard?.writeText(shareUrl); } catch { /* noop */ }
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2000);
  };

  const vehicleName = vehicle ? [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || vehicle.vehicleType || "Assigned vehicle" : "Vehicle will appear after acceptance";
  const bookingFare = booking?.estimatedFare || trip?.fare || booking?.fare?.finalFare;

  return (
    <div className="trip-history-experience">
      <div className="trip-hero-banner">
        <div className="trip-hero-art" aria-hidden="true" />
        <div className="trip-hero-content">
          <div className="trip-hero-icon"><span>🚕</span></div>
          <div className="trip-hero-copy">
            <span>TRAVELS LIVE DISPATCH</span>
            <h3>Status: <strong>{activeStatus}</strong></h3>
            <p>{searching ? "Broadcasting your ride to nearby eligible drivers…" : driver ? "Your driver has accepted the ride request." : "Your trip is being prepared."}</p>
            <small>Smart dispatch is matching the nearest eligible driver for you.</small>
          </div>
        </div>
        <div className="trip-hero-right">
          {activeStatus !== "Completed" && activeStatus !== "Cancelled" && (
            <div className="trip-otp-badge">
              <span>{otpWasVerified ? "PICKUP OTP" : "RIDE START OTP"}</span>
              <strong className={!otpCode ? "trip-otp-pending" : ""}>{otpDisplay}</strong>
              {activeStatus === "Scheduled" && !otpCode && <small className="trip-otp-hint">Shown when your driver generates it</small>}
            </div>
          )}
          <span className={`trip-live-pill ${searching ? "is-searching" : ""}`}><i />{searching ? `Searching${countdown ? ` · ${countdown}s` : "…"}` : activeStatus}</span>
        </div>
      </div>

      <div className="trip-stepper" aria-label="Trip progress">
        {STEPS.map(([label, caption], index) => {
          const passed = index <= activeStep;
          return (
            <React.Fragment key={label}>
              <div className={`trip-step ${passed ? "passed" : ""} ${index === activeStep ? "current" : ""}`}>
                <div className="trip-step-node">{passed ? <CheckCircle2 size={17} /> : index + 1}</div>
                <strong>{label}</strong>
                <span>{caption}</span>
              </div>
              {index < STEPS.length - 1 && <div className={`trip-step-line ${index < activeStep ? "passed" : ""}`} />}
            </React.Fragment>
          );
        })}
      </div>

      <div className="trip-main-grid">
        <section className="trip-details-card">
          <div className="trip-search-heading">
            <div className="trip-search-icon"><Sparkles size={20} /></div>
            <div><h4>{searching ? "Finding your nearest eligible driver…" : driver ? "Your driver is on the way" : "Trip details"}</h4><p>{searching ? "We are contacting nearby drivers. This usually takes less than a minute." : "Everything you need for a smooth journey is right here."}</p></div>
            {searching && <div className="trip-search-dots"><i /><i /><i /></div>}
          </div>

          <div className="trip-location-stack">
            <div className="trip-location-row pickup">
              <div className="trip-location-thumb pickup-thumb"><MapPin size={18} /></div>
              <div><span>PICKUP LOCATION</span><strong>{booking?.pickupLocation || "Pickup location"}</strong><small>Exact pickup point selected</small></div>
              <Navigation size={17} className="trip-location-arrow" />
            </div>
            <div className="trip-location-connector" />
            <div className="trip-location-row drop">
              <div className="trip-location-thumb drop-thumb"><MapPin size={18} /></div>
              <div><span>DROP LOCATION</span><strong>{booking?.dropLocation || "Destination"}</strong><small>Destination selected</small></div>
              <Navigation size={17} className="trip-location-arrow" />
            </div>
          </div>

          <div className="trip-metrics">
            <div><span className="metric-icon">⌁</span><div><strong>{booking?.distanceKmExact || booking?.distanceKm || "—"}{booking?.distanceKmExact || booking?.distanceKm ? " km" : ""}</strong><small>Estimated distance</small></div></div>
            <div><span className="metric-icon">◷</span><div><strong>{booking?.durationMinutes ? `${booking.durationMinutes} min` : "—"}</strong><small>Estimated time</small></div></div>
            <div><span className="metric-icon">🚕</span><div><strong>{vehicle?.vehicleType || vehicle?.category?.name || booking?.vehicleCategory?.name || "Mini"}</strong><small>Selected vehicle</small></div></div>
            <div><span className="metric-icon">₹</span><div><strong>{bookingFare ? formatMoney(bookingFare) : "Fare on confirmation"}</strong><small>Estimated fare</small></div></div>
          </div>

          {driver && (
            <div className="trip-driver-card">
              <div className="trip-driver-avatar">{driver?.profileImage ? <img src={driver.profileImage} alt="Driver" /> : "👤"}<span><UserCheck size={12} /></span></div>
              <div className="trip-driver-info"><span>VERIFIED DRIVER</span><strong>{driver?.name || "Travels Driver"}</strong><small><Star size={13} fill="currentColor" /> {driver?.rating || "4.9"} · {vehicleName}</small></div>
              {driver?.phone && <a href={`tel:${driver.phone}`} className="trip-call-button" aria-label="Call driver"><Phone size={17} /></a>}
            </div>
          )}

          <div className="trip-actions">
            <button className="trip-sos-button" onClick={() => setShowSosModal(true)}><ShieldAlert size={17} /> EMERGENCY SOS</button>
            <button className="trip-share-button" onClick={handleCopyShareLink}><Navigation size={17} /> {copiedLink ? "Link Copied!" : "Share Live Trip"}</button>
          </div>
        </section>

        <section className="trip-control-card">
          <div className="trip-control-head">
            <div><span className="section-label">JOURNEY CONTROL</span><h4>{searching ? "Smart driver matching" : "Your journey at a glance"}</h4><p>{searching ? "Your request is moving through the eligible driver queue one driver at a time." : "A clean status view keeps every important trip detail visible without a map."}</p></div>
            <div className={`control-live-badge ${searching ? "searching" : ""}`}><i />{searching ? "SEARCHING" : "LIVE STATUS"}</div>
          </div>
          <div className="control-route-visual">
            <div className="control-point"><span className="control-point-icon pickup">1</span><div><small>PICKUP</small><strong>{booking?.pickupLocation || "Pickup location"}</strong><em>Ready for pickup</em></div></div>
            <div className="control-connector"><span>{searching ? "MATCHING" : driver ? "DRIVER CONFIRMED" : "PREPARING"}</span><i /></div>
            <div className="control-point"><span className="control-point-icon destination">2</span><div><small>DESTINATION</small><strong>{booking?.dropLocation || "Destination"}</strong><em>Final destination</em></div></div>
          </div>
          <div className="control-stat-grid">
            <div><span>DRIVER</span><strong>{driver ? (driver?.name || "Assigned") : "Searching"}</strong><small>{driver ? "Confirmed" : "Next eligible driver"}</small></div>
            <div><span>VEHICLE</span><strong>{vehicle?.vehicleType || vehicle?.category?.name || "Pending"}</strong><small>{vehicleName}</small></div>
            <div><span>DISTANCE</span><strong>{booking?.distanceKmExact || booking?.distanceKm ? `${booking.distanceKmExact || booking.distanceKm} km` : "—"}</strong><small>Estimated road distance</small></div>
            <div><span>ETA</span><strong>{booking?.durationMinutes ? `${booking.durationMinutes} min` : "—"}</strong><small>Estimated travel time</small></div>
          </div>
          <div className="control-footer"><span><CheckCircle2 size={15} /> No map required — trip status, driver and journey details stay synchronized.</span><button type="button" onClick={() => window.location.reload()} title="Refresh trip status"><RefreshCw size={14} /> Refresh status</button></div>
        </section>
      </div>

      {showSosModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border-2 border-red-600 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600"><ShieldAlert size={32} /><div><h3 className="font-outfit text-xl font-black text-gray-900">Travels SOS</h3><p className="text-xs text-red-600 font-semibold">Immediate emergency support</p></div></div>
            <p className="text-xs text-gray-600">Your live trip details can be shared with the Travels safety team when SOS is triggered.</p>
            <a href="tel:112" className="w-full bg-red-600 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"><Phone size={16} /> Call Emergency (112)</a>
            <button onClick={() => { onSosTrigger?.(); setShowSosModal(false); }} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-sm">Notify Travels Control Room</button>
            <button onClick={() => setShowSosModal(false)} className="w-full text-xs text-gray-500 font-semibold py-1">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
