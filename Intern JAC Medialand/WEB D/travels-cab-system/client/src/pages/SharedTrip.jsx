import { useEffect, useState } from "react";
import { Navigation, ShieldCheck } from "lucide-react";
import api from "../services/api";

const SharedTrip = () => {
  const token = window.location.pathname.split("/").filter(Boolean).pop();
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api.get(`/tripshare/shared/${token}`).then((response) => setTrip(response.data.trip)).catch((err) => setError(err.response?.data?.message || "Shared trip is unavailable.")); }, [token]);
  if (error) return <main className="simple-page"><div className="simple-card"><span className="section-label">TRAVELS CAB</span><h1>Trip unavailable.</h1><p>{error}</p></div></main>;
  if (!trip) return <main className="simple-page"><div className="simple-card"><span className="section-label">TRAVELS CAB</span><h1>Loading trip…</h1></div></main>;
  return <main className="simple-page"><div className="simple-card shared-trip-card"><span className="section-label">SHARED JOURNEY</span><h1>Trip in progress.</h1><div className="shared-route"><span>{trip.booking?.pickupLocation}</span><Navigation size={18}/><span>{trip.booking?.dropLocation}</span></div><div className="shared-trip-meta"><span><ShieldCheck size={16}/> {trip.status}</span><span>Vehicle: {trip.vehicle?.vehicleNumber || "Assigned"}</span></div></div></main>;
};
export default SharedTrip;
