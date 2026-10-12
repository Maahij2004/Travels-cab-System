import { useEffect, useRef, useState } from "react";
import { Crosshair, LoaderCircle, MapPin, X } from "lucide-react";
import { createAutocompleteSession, getCurrentLocation, resolvePlace, searchPlaces } from "../../services/mapsService";

const ExactLocationPicker = ({ label, placeholder, value, selectedPlace, onChange, onSelect }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [mapsError, setMapsError] = useState("");
  const sessionRef = useRef(null);
  const requestRef = useRef(0);
  const wrapperRef = useRef(null);

  useEffect(() => {
    createAutocompleteSession().then((session) => { sessionRef.current = session; }).catch(() => {});
  }, []);

  useEffect(() => {
    const handleOutside = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    const query = value.trim();
    if (selectedPlace || query.length < 3) {
      setSuggestions([]);
      return undefined;
    }
    const requestId = ++requestRef.current;
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setMapsError("");
        const results = await searchPlaces(query, sessionRef.current);
        if (requestId === requestRef.current) {
          setSuggestions(results);
          setOpen(results.length > 0);
        }
      } catch (error) {
        if (requestId === requestRef.current) setMapsError(error.message || "Location search failed.");
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [value, selectedPlace]);

  const choose = async (item) => {
    try {
      setLoading(true);
      const place = await resolvePlace(item);
      onChange(place.name);
      onSelect(place);
      setSuggestions([]);
      setOpen(false);
    } catch (error) {
      setMapsError(error.message || "Unable to select this location.");
    } finally {
      setLoading(false);
    }
  };

  const edit = (nextValue) => {
    onChange(nextValue);
    onSelect(null);
    setOpen(true);
    setMapsError("");
  };

  const useCurrentLocation = async () => {
    try {
      setLoading(true);
      setMapsError("");
      const place = await getCurrentLocation();
      onChange(place.name);
      onSelect(place);
      setSuggestions([]);
      setOpen(false);
    } catch (error) {
      setMapsError(error.message || "Unable to get your current location.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="exact-location-picker" ref={wrapperRef}>
      <label>{label}</label>
      <div className={`exact-location-input ${selectedPlace ? "selected" : ""}`}>
        <MapPin size={17} />
        <input value={value} onChange={(event) => edit(event.target.value)} onFocus={() => suggestions.length && setOpen(true)} placeholder={placeholder} autoComplete="off" aria-label={label} />
        {loading && <LoaderCircle className="spin" size={16} />}
        {selectedPlace && <button type="button" className="clear-location" onClick={() => edit("")} aria-label={`Change ${label}`}><X size={15} /></button>}
        {!selectedPlace && <button type="button" className="current-location-button" onClick={useCurrentLocation} aria-label={`Use current location for ${label}`} title="Use my current location"><Crosshair size={15} /></button>}
      </div>
      {selectedPlace && <small className="selected-location-address">{selectedPlace.address}</small>}
      <small className="maps-key-warning free-map-note">Free map search · OpenStreetMap data</small>
      {mapsError && <small className="field-error">{mapsError}</small>}
      {open && suggestions.length > 0 && (
        <div className="exact-location-suggestions">
          {suggestions.map((item) => (
            <button type="button" key={item.placeId} className="exact-location-option" onClick={() => choose(item)}>
              <span className="suggestion-pin"><MapPin size={15} /></span>
              <span><strong>{item.mainText}</strong><small>{item.secondaryText}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExactLocationPicker;
