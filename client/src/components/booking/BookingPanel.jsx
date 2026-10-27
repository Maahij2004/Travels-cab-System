import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Car, Clock3, MapPin, Navigation, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ExactLocationPicker from "./ExactLocationPicker";
import { computeDrivingRoute, isMapsConfigured } from "../../services/mapsService";

const tripTypes = [
  ["One way", "one_way"],
  ["Round trip", "round_trip"],
  ["Hourly Rental", "hourly"],
  ["Outstation", "outstation_travel"],
];

const popularLocations = [
  { name: "International Airport", lat: 11.0298, lng: 77.0434 },
  { name: "Central Railway Station", lat: 11.0018, lng: 76.9629 },
  { name: "TIDEL Park / IT Corridor", lat: 11.0242, lng: 77.0028 },
  { name: "Gandhipuram City Bus Stand", lat: 11.0168, lng: 76.9678 },
];

const redTaxiCategories = [
  { id: "mini", name: "Red Go / Mini", tag: "Affordable AC", estPerKm: "₹14/km", seats: "4 Seats" },
  { id: "sedan", name: "Red Sedan", tag: "Top Rated Comfort", estPerKm: "₹17/km", seats: "4 Seats" },
  { id: "suv", name: "Red SUV / XL", tag: "6-Seater Family", estPerKm: "₹22/km", seats: "6 Seats" },
];

const BookingPanel = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [tripType, setTripType] = useState("one_way");
  const [selectedCab, setSelectedCab] = useState("sedan");
  const [form, setForm] = useState({
    pickupLocation: "",
    dropLocation: "",
    pickupPlace: null,
    dropPlace: null,
    travelDate: new Date().toISOString().slice(0, 10),
    travelTime: new Date().toTimeString().slice(0, 5),
    passengerCount: "1",
    tripType: "one_way",
  });
  const [route, setRoute] = useState(null);
  const [error, setError] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    if (!form.pickupPlace || !form.dropPlace) {
      setRoute(null);
      return undefined;
    }
    let cancelled = false;
    setRouteLoading(true);
    computeDrivingRoute(form.pickupPlace, form.dropPlace)
      .then((result) => {
        if (!cancelled) setRoute(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setRoute(null);
          setError(err.message || "Unable to calculate the driving route.");
        }
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.pickupPlace, form.dropPlace]);

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    if (!form.pickupPlace || !form.dropPlace)
      return setError("Select both pickup and destination locations.");
    if (!form.travelDate || !form.travelTime)
      return setError("Please select your travel date and time.");
    if (!route) return setError("Calculating road route... Please wait.");

    sessionStorage.setItem(
      "travels_booking_draft",
      JSON.stringify({
        ...form,
        vehicleCategory: selectedCab,
        distanceKm: route.distanceKm,
        distanceKmExact: route.distanceKmExact,
        durationMinutes: route.durationMinutes,
      })
    );

    if (isAuthenticated && user?.role === "customer") navigate("/customer/book");
    else navigate("/login", { state: { from: "/customer/book" } });
  };

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const setPresetDrop = (loc) => {
    const place = { label: loc.name, lat: loc.lat, lng: loc.lng };
    update("dropLocation", loc.name);
    update("dropPlace", place);
  };

  return (
    <form className="booking-panel red-taxi-card shadow-2xl rounded-2xl p-6 bg-white border border-red-100" onSubmit={handleSubmit}>
      {/* Header Badge */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
        <div>
          <span className="font-outfit font-extrabold text-xs uppercase tracking-wider text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-200 inline-flex items-center gap-1">
            <Sparkles size={13} className="text-red-600 animate-pulse" /> RED TAXI INSTANT BOOKING
          </span>
          <h2 className="font-jakarta text-2xl font-bold text-gray-900 mt-1">Book Your Red Ride</h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
          <ShieldCheck size={15} /> Instant Dispatch
        </div>
      </div>

      {/* Trip Types Pills */}
      <div className="grid grid-cols-4 gap-1.5 mb-5 p-1 bg-gray-100/80 rounded-xl">
        {tripTypes.map(([label, value]) => (
          <button
            type="button"
            key={value}
            className={`font-jakarta text-xs font-semibold py-2 px-1 text-center rounded-lg transition-all duration-200 ${
              tripType === value
                ? "bg-red-600 text-white shadow-md font-bold"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
            }`}
            onClick={() => {
              setTripType(value);
              update("tripType", value);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Pickup & Destination Inputs */}
      <div className="space-y-3 mb-4">
        <ExactLocationPicker
          label="Pickup Location"
          placeholder="Search pickup (e.g. Home, Airport, Station)"
          value={form.pickupLocation}
          selectedPlace={form.pickupPlace}
          onChange={(value) => update("pickupLocation", value)}
          onSelect={(place) => update("pickupPlace", place)}
        />

        <ExactLocationPicker
          label="Destination / Drop"
          placeholder="Search drop location"
          value={form.dropLocation}
          selectedPlace={form.dropPlace}
          onChange={(value) => update("dropLocation", value)}
          onSelect={(place) => update("dropPlace", place)}
        />
      </div>

      {/* Quick Location Shortcuts */}
      <div className="mb-4">
        <span className="text-[11px] font-medium text-gray-500 block mb-1.5 uppercase tracking-wide">Popular Quick Drop Points:</span>
        <div className="flex flex-wrap gap-1.5">
          {popularLocations.map((loc) => (
            <button
              type="button"
              key={loc.name}
              onClick={() => setPresetDrop(loc)}
              className="text-xs font-dmsans bg-gray-50 hover:bg-red-50 text-gray-700 hover:text-red-700 border border-gray-200 hover:border-red-300 rounded-lg px-2.5 py-1 transition-colors flex items-center gap-1"
            >
              <MapPin size={11} className="text-red-500" /> {loc.name}
            </button>
          ))}
        </div>
      </div>

      {/* Red Taxi Cab Category Selector */}
      <div className="mb-4">
        <label className="text-xs font-jakarta font-bold text-gray-800 block mb-2">Select Red Taxi Category:</label>
        <div className="grid grid-cols-3 gap-2">
          {redTaxiCategories.map((cab) => (
            <button
              type="button"
              key={cab.id}
              onClick={() => setSelectedCab(cab.id)}
              className={`p-2.5 rounded-xl border text-left transition-all relative ${
                selectedCab === cab.id
                  ? "border-red-600 bg-red-50/70 shadow-sm ring-2 ring-red-500/20"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Car size={16} className={selectedCab === cab.id ? "text-red-600" : "text-gray-500"} />
                <span className="font-space text-[11px] font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{cab.estPerKm}</span>
              </div>
              <div className="font-jakarta text-xs font-bold text-gray-900">{cab.name}</div>
              <div className="text-[10px] text-gray-500">{cab.tag}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Date & Time & Passengers */}
      <div className="booking-date-time-grid grid grid-cols-3 gap-2 mb-4">
        <label className="bg-gray-50 p-2 rounded-xl border border-gray-200 block">
          <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
            <CalendarDays size={12} className="text-red-600" /> Date
          </span>
          <input
            type="date"
            className="booking-date-time-input w-full bg-transparent text-xs font-space font-semibold text-gray-900 focus:outline-none mt-0.5"
            value={form.travelDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => update("travelDate", e.target.value)}
            required
          />
        </label>

        <label className="bg-gray-50 p-2 rounded-xl border border-gray-200 block">
          <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
            <Clock3 size={12} className="text-red-600" /> Time
          </span>
          <input
            type="time"
            className="booking-date-time-input w-full bg-transparent text-xs font-space font-semibold text-gray-900 focus:outline-none mt-0.5"
            value={form.travelTime}
            onChange={(e) => update("travelTime", e.target.value)}
            required
          />
        </label>

        <label className="bg-gray-50 p-2 rounded-xl border border-gray-200 block">
          <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
            <Users size={12} className="text-red-600" /> Seats
          </span>
          <select
            value={form.passengerCount}
            onChange={(e) => update("passengerCount", e.target.value)}
            className="w-full bg-transparent text-xs font-space font-semibold text-gray-900 focus:outline-none mt-0.5"
          >
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <option key={num} value={num}>
                {num} {num === 1 ? "Passenger" : "Passengers"}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Distance & Est Fare banner */}
      <div className="bg-slate-900 text-white rounded-xl p-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation size={18} className="text-red-400 animate-pulse" />
          <div>
            <div className="text-[11px] text-gray-400 font-medium">Estimated Route Distance</div>
            <div className="font-space text-sm font-bold text-white">
              {routeLoading ? "Calculating distance..." : route ? `${route.distanceKmExact} KM (${route.durationMinutes} min)` : "Enter Locations"}
            </div>
          </div>
        </div>
        {route && (
          <div className="text-right">
            <div className="text-[10px] text-red-300 font-semibold uppercase">Est. Fare</div>
            <div className="font-space text-lg font-bold text-red-400">
              ₹{Math.round(route.distanceKmExact * (selectedCab === "suv" ? 22 : selectedCab === "sedan" ? 17 : 14) + 100)}
            </div>
          </div>
        )}
      </div>

      {error && <div className="p-3 mb-4 bg-red-50 text-red-700 text-xs font-semibold rounded-xl border border-red-200">{error}</div>}

      <button
        type="submit"
        className="w-full bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-jakarta font-bold text-base py-3 px-4 rounded-xl shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
      >
        <span>{isAuthenticated ? "Proceed to Book Red Taxi" : "Sign In & Confirm Ride"}</span>
        <ArrowRight size={18} />
      </button>
    </form>
  );
};

export default BookingPanel;
