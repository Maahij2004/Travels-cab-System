import { useCallback, useEffect, useState } from "react";
import { Activity, BarChart3, CarFront, ClipboardList, DollarSign, FileBarChart, LogOut, Megaphone, Plus, RefreshCw, Settings2, ShieldAlert, Star, Ticket, UserCog, Users, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

const sections = [
  ["overview", "Dashboard", Activity], ["bookings", "Bookings", ClipboardList], ["drivers", "Drivers", UserCog], ["vehicles", "Vehicles", CarFront], ["customers", "Customers", Users], ["categories", "Categories", Settings2], ["pricing", "Pricing", DollarSign], ["coupons", "Coupons", Ticket], ["payments", "Payments", DollarSign], ["ratings", "Ratings", Star], ["reports", "Reports", FileBarChart], ["rideguard", "RideGuard", ShieldAlert], ["incident-center", "Incident Center", ShieldAlert], ["fare-guard", "Fare Guard", DollarSign], ["rewards", "Driver Rewards", Star], ["support", "Support", Megaphone], ["safety", "SOS", ShieldAlert],
];

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [section, setSection] = useState("overview");
  const [stats, setStats] = useState(null);
  const [data, setData] = useState({ bookings: [], drivers: [], vehicles: [], customers: [], categories: [], pricing: [], coupons: [], payments: [], tickets: [], sos: [], ratings: [], rideguard: [], incidentCenter: { incidents: [], summary: {} }, fareGuard: [], rewards: [], reports: null });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [assignBooking, setAssignBooking] = useState(null);
  const [assignForm, setAssignForm] = useState({ driverId: "", vehicleId: "" });
  const [detailRecord, setDetailRecord] = useState(null);
  const [detailType, setDetailType] = useState("");
  const [detailMeta, setDetailMeta] = useState(null);

  const request = async (path, options = {}) => {
    try {
      const response = await api({ url: path, ...options });
      return response.data;
    } catch (err) {
      const status = err.response?.status ? ` (${err.response.status})` : "";
      const serverMessage = err.response?.data?.message || err.message || "Request failed";
      const requestUrl = err.config?.baseURL ? `${err.config.baseURL}${err.config.url || ""}` : path;
      throw new Error(`${serverMessage}${status} — ${requestUrl}`);
    }
  };

  const load = useCallback(async () => {
    setError("");
    try {
      const [dashboard, bookings, drivers, vehicles, customers, categories] = await Promise.all([
        request("/dashboard/stats"), request("/bookings"), request("/drivers"), request("/vehicles"), request("/customers"), request("/vehicle-categories"),
      ]);
      setStats(dashboard.dashboard); setData((current) => ({ ...current, bookings: bookings.bookings || [], drivers: drivers.drivers || [], vehicles: vehicles.vehicles || [], customers: customers.customers || [], categories: categories.categories || [] }));
    } catch (err) { setError(err.message || "Unable to load administration data."); }

  }, []);

  const loadSection = useCallback(async (name) => {
    setError("");
    try {
      if (name === "pricing") { const value = await request("/pricing"); setData((d) => ({ ...d, pricing: value.pricing || [] })); }
      if (name === "coupons") { const value = await request("/coupons"); setData((d) => ({ ...d, coupons: value.coupons || [] })); }
      if (name === "payments") { const value = await request("/payments"); setData((d) => ({ ...d, payments: value.payments || [] })); }
      if (name === "support") { const value = await request("/support"); setData((d) => ({ ...d, tickets: value.tickets || [] })); }
      if (name === "safety") { const safety = await request("/SOS"); setData((d) => ({ ...d, sos: safety.alerts || safety.sos || safety.SOS || [] })); }
      if (name === "ratings") { const value = await request("/ratings/admin/all"); setData((d) => ({ ...d, ratings: value.ratings || [] })); }
      if (name === "rideguard") { const value = await request("/rideguard/incidents"); setData((d) => ({ ...d, rideguard: value.incidents || [] })); }
      if (name === "incident-center") {
        let value;
        try {
          value = await request("/rideguard/admin/incident-center");
        } catch (firstError) {
          if (firstError.message.includes("404")) value = await request("/rideguard/admin/incidents");
          else throw firstError;
        }
        setData((d) => ({ ...d, incidentCenter: { incidents: value.incidents || [], summary: value.summary || {} } }));
      }
      if (name === "fare-guard") { const value = await request("/rideguard/admin/fare-transparency"); setData((d) => ({ ...d, fareGuard: value.rows || [] })); }
      if (name === "rewards") { const drivers = await request("/drivers"); setData((d) => ({ ...d, rewards: drivers.drivers || [] })); }
      if (name === "reports") {
        const [b, t, p, r] = await Promise.all([request("/reports/bookings"), request("/reports/trips"), request("/reports/payments"), request("/reports/ratings")]);
        setData((d) => ({ ...d, reports: { bookings: b, trips: t, payments: p, ratings: r } }));
      }
    } catch (err) {
      setError(err.message || `Unable to load ${name}.`);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (section !== "overview") loadSection(section); }, [section, loadSection]);

  const updateBookingStatus = async (bookingId, status) => { try { await api.patch(`/bookings/${bookingId}/status`, { status }); setMessage(`Booking updated to ${status}.`); await load(); } catch (err) { setError(err.response?.data?.message || "Unable to update booking."); } };
  const autoAssign = async (bookingId) => { try { await api.post(`/assignments/${bookingId}/auto`); setMessage("Driver and vehicle assigned."); await load(); } catch (err) { setError(err.response?.data?.message || "Automatic assignment failed."); } };
  const openManualAssign = async (booking) => {
    try {
      const [driversResponse, vehiclesResponse] = await Promise.all([api.get("/drivers/available"), api.get(`/vehicles/available?category=${booking.vehicleCategory?._id || booking.vehicleCategory}&passengers=${booking.passengerCount || 1}`)]);
      setAvailableDrivers(driversResponse.data.drivers || []); setAvailableVehicles(vehiclesResponse.data.vehicles || []); setAssignBooking(booking); setAssignForm({ driverId: "", vehicleId: "" });
    } catch (err) { setError(err.response?.data?.message || "Unable to load available drivers and vehicles."); }
  };
  const manualAssign = async () => {
    if (!assignBooking || !assignForm.driverId || !assignForm.vehicleId) return setError("Select both a driver and vehicle.");
    try { await api.post(`/assignments/${assignBooking._id}/manual`, assignForm); setAssignBooking(null); setMessage("Driver and vehicle manually assigned."); await load(); } catch (err) { setError(err.response?.data?.message || "Manual assignment failed."); }
  };
  const updateDriverStatus = async (id, status) => { try { await api.patch(`/drivers/${id}/status`, { status }); setMessage("Driver status updated."); await load(); } catch (err) { setError(err.response?.data?.message || "Unable to update driver."); } };
  const updateVehicleStatus = async (id, status) => { try { await api.patch(`/vehicles/${id}/status`, { status }); setMessage("Vehicle status updated."); await load(); } catch (err) { setError(err.response?.data?.message || "Unable to update vehicle."); } };
  const openDetails = async (type, id) => {
    try {
      const response = await api.get(`/${type === "customer" ? "customers" : "drivers"}/${id}`);
      setDetailType(type); setDetailRecord(response.data.customer || response.data.driver || null); setDetailMeta(response.data.adminDetails || null);
    } catch (err) { setError(err.response?.data?.message || `Unable to load ${type} details.`); }
  };

  const updateRideGuardIncident = async (id, status) => {
    try { await api.patch(`/rideguard/incidents/${id}`, { status }); setMessage(`RideGuard incident marked ${status}.`); await loadSection("rideguard"); }
    catch (err) { setError(err.response?.data?.message || "Unable to update RideGuard incident."); }
  };

  const updateDriverRewards = async (driver, trusted) => {
    try {
      await api.patch(`/rideguard/rewards/${driver._id}`, {
        points: Number(driver.rewardPoints || 0) + (trusted ? 100 : 0),
        trustedDriver: trusted,
        reason: trusted ? "Trusted Driver award" : "Trusted Driver status removed",
      });
      setMessage(trusted ? "Driver marked Trusted and awarded 100 reward points." : "Trusted status removed.");
      await load();
    } catch (err) { setError(err.response?.data?.message || "Unable to update driver rewards."); }
  };

  const adjustDriverPoints = async (driver, delta) => {
    const current = Number(driver.rewardPoints || 0);
    const next = Math.max(0, current + Number(delta));
    const reason = delta > 0 ? "Admin reward bonus" : "Admin reward deduction";
    try { await api.patch(`/rideguard/rewards/${driver._id}`, { points: next, reason }); setMessage(`${delta > 0 ? "Added" : "Deducted"} ${Math.abs(delta)} reward points.`); await loadSection("rewards"); }
    catch (err) { setError(err.response?.data?.message || "Unable to adjust reward points."); }
  };

  const createResource = async () => {
    try {
      if (modal === "category") await api.post("/vehicle-categories", { ...form, seatingCapacity: Number(form.seatingCapacity) });
      if (modal === "driver") await api.post("/drivers", { ...form, experienceYears: Number(form.experienceYears || 0) });
      if (modal === "coupon") await api.post("/coupons", { ...form, discountValue: Number(form.discountValue), validFrom: form.validFrom, validUntil: form.validUntil });
      setMessage(`${modal} created successfully.`); setModal(null); setForm({}); await load(); if (section !== "overview") await loadSection(section);
    } catch (err) { setError(err.response?.data?.message || `Unable to create ${modal}.`); }
  };

  const statCards = stats ? [["Bookings", stats.bookings, Activity], ["Customers", stats.customers, Users], ["Drivers", stats.drivers, UserCog], ["Vehicles", stats.vehicles, CarFront], ["Ongoing trips", stats.ongoingTrips, NavigationIcon], ["Revenue", `₹${Number(stats.totalRevenue || 0).toLocaleString("en-IN")}`, BarChart3]] : [];
  const heading = sections.find(([key]) => key === section)?.[1] || "Dashboard";

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar"><div className="admin-brand"><span>TRAVELS</span><strong>ADMIN</strong></div><nav>{sections.map(([key, label, Icon]) => <button key={key} className={section === key ? "active" : ""} onClick={() => { setSection(key); setError(""); setMessage(""); }}><Icon size={16} />{label}</button>)}</nav><button className="dashboard-logout" onClick={logout}><LogOut size={16} /> Logout</button></aside>
      <section className="admin-main"><header className="dashboard-header"><div><span className="section-label">ADMIN CONTROL</span><h1>{heading}.</h1><p>Welcome, {user?.name || "Travels Super Admin"}. Manage the complete booking operation.</p></div><button className="icon-button" onClick={load}><RefreshCw size={16} /></button></header>{message && <div className="dashboard-alert success">{message}</div>}{error && <div className="dashboard-alert error">{error}</div>}
        {section === "overview" && <><div className="stats-grid">{statCards.map(([label, value, Icon]) => <article className="stat-card" key={label}><Icon size={18} /><small>{label}</small><strong>{value}</strong></article>)}</div><section className="dashboard-card"><div className="card-heading"><h2>Operational shortcuts</h2></div><div className="admin-shortcuts">{[["bookings","Manage bookings"],["drivers","Manage drivers"],["vehicles","Manage vehicles"],["pricing","Pricing controls"],["reports","Reports"]].map(([key,label]) => <button key={key} onClick={() => setSection(key)}>{label}</button>)}</div></section></>}
        {section === "bookings" && <DataTable title="All bookings" rows={data.bookings} columns={["bookingId","pickupLocation","dropLocation","status"]} renderActions={(row) => <div className="table-actions"><button onClick={() => updateBookingStatus(row._id,"Confirmed")}>Confirm</button><button onClick={() => autoAssign(row._id)}>Auto assign</button><button onClick={() => openManualAssign(row)}>Manual assign</button><button onClick={() => updateBookingStatus(row._id,"Cancelled")}>Cancel</button></div>} />}
        {section === "drivers" && <><div className="section-actions"><button className="dashboard-primary compact" onClick={() => { setModal("driver"); setForm({}); }}><Plus size={15}/> Add driver</button></div><DataTable title="Drivers" rows={data.drivers} columns={["driverId","fullName","phone","status","reliabilityScore","trustedDriver","rewardPoints"]} renderActions={(row) => <div className="table-actions"><button onClick={() => openDetails("driver", row._id)}>View details</button><button onClick={() => updateDriverStatus(row._id,"Available")}>Available</button><button onClick={() => updateDriverStatus(row._id,"On Leave")}>Leave</button><button onClick={() => updateDriverRewards(row, true)}>Trust +100</button><button onClick={() => updateDriverRewards(row, false)}>Remove trust</button></div>} /></>}
        {section === "vehicles" && <DataTable title="Vehicles" rows={data.vehicles} columns={["vehicleId","vehicleNumber","brand","model","status"]} renderActions={(row) => <div className="table-actions"><button onClick={() => updateVehicleStatus(row._id,"Available")}>Available</button><button onClick={() => updateVehicleStatus(row._id,"Under Maintenance")}>Maintenance</button></div>} />}
        {section === "customers" && <DataTable title="Customers" rows={data.customers} columns={["customerId","fullName","email","phone"]} renderActions={(row) => <div className="table-actions"><button onClick={() => openDetails("customer", row._id)}>View full profile</button></div>} />}
        {section === "categories" && <><div className="section-actions"><button className="dashboard-primary compact" onClick={() => { setModal("category"); setForm({}); }}><Plus size={15}/> Add category</button></div><DataTable title="Vehicle categories" rows={data.categories} columns={["name","code","pricingGroup","seatingCapacity","isActive"]} /></>}
        {section === "pricing" && <DataTable title="Pricing rules" rows={data.pricing} columns={["name","pricingGroup","baseFare","perKmRate","minimumFare","isActive"]} />}
        {section === "coupons" && <><div className="section-actions"><button className="dashboard-primary compact" onClick={() => { setModal("coupon"); setForm({ discountType:"Percentage" }); }}><Plus size={15}/> Add coupon</button></div><DataTable title="Coupons" rows={data.coupons} columns={["code","discountType","discountValue","validFrom","validUntil","isActive"]} /></>}
        {section === "payments" && <DataTable title="Payments" rows={data.payments} columns={["paymentId","method","amount","status"]} />}
        {section === "rideguard" && <DataTable title="RideGuard incidents · Phase 1–4" rows={data.rideguard} columns={["createdAt","booking","type","customer","driver","requestedAmount","lockedFare","status","resolution"]} renderActions={(row) => <div className="table-actions"><button onClick={() => updateRideGuardIncident(row._id, "Investigating")}>Investigate</button><button onClick={() => updateRideGuardIncident(row._id, "Resolved")}>Resolve</button></div>} />}
        {section === "incident-center" && <section><div className="stats-grid incident-summary-grid">{[["Total",data.incidentCenter.summary.total], ["Open",data.incidentCenter.summary.open], ["Investigating",data.incidentCenter.summary.investigating], ["Critical",data.incidentCenter.summary.critical], ["High",data.incidentCenter.summary.high], ["Resolved",data.incidentCenter.summary.resolved]].map(([label,value])=><article className="stat-card" key={label}><ShieldAlert size={18}/><small>{label}</small><strong>{value || 0}</strong></article>)}</div><div className="dashboard-card"><div className="card-heading"><div><span className="section-label">RIDEGUARD · PHASE 5</span><h2>Admin Incident Center</h2></div><span>Central resolution queue</span></div><p className="muted-text">Every protection incident is visible here with severity, ownership, resolution and audit notes. Use the actions to move incidents from investigation to resolution.</p></div><DataTable title="Incident resolution queue" rows={data.incidentCenter.incidents} columns={["createdAt","severity","type","booking","customer","driver","requestedAmount","lockedFare","status","assignedTo","resolution","adminNotes"]} renderActions={(row)=><div className="table-actions"><button onClick={()=>updateRideGuardIncident(row._id,"Investigating")}>Investigate</button><button onClick={()=>updateRideGuardIncident(row._id,"Resolved")}>Resolve</button><button onClick={()=>updateRideGuardIncident(row._id,"Rejected")}>Reject</button></div>} /></section>}
        {section === "fare-guard" && <><div className="dashboard-card"><div className="card-heading"><div><span className="section-label">RIDEGUARD · PHASE 6</span><h2>Transparent Fare Ledger</h2></div><span>No hidden fare changes</span></div><p className="muted-text">Compare each booking's locked fare with the final fare and show the approved reason for any visible variance.</p></div><DataTable title="Fare transparency" rows={data.fareGuard} columns={["bookingId","customer","assignedDriver","assignedVehicle","estimatedFare","lockedFare","couponDiscount","distanceKm","tripType","status","trip","variance","fareLockedAt"]} /></>}
        {section === "rewards" && <><div className="dashboard-card"><div className="card-heading"><div><span className="section-label">RIDEGUARD · PHASE 6</span><h2>Driver Rewards Program</h2></div><span>Performance-based points</span></div><p className="muted-text">Reward reliable service with transparent points. Trusted Driver status and reward points remain visible to both operations and the driver.</p></div><DataTable title="Driver reward accounts" rows={data.rewards} columns={["driverId","fullName","reliabilityScore","trustedDriver","rewardPoints","status"]} renderActions={(row)=><div className="table-actions"><button onClick={()=>adjustDriverPoints(row,100)}>+100</button><button onClick={()=>adjustDriverPoints(row,-50)}>-50</button><button onClick={()=>updateDriverRewards(row,true)}>Trust +100</button><button onClick={()=>updateDriverRewards(row,false)}>Remove trust</button></div>} /></>}
        {section === "support" && <DataTable title="Support tickets" rows={data.tickets} columns={["subject","status","priority","createdAt"]} />}
        {section === "safety" && <DataTable title="SOS alerts" rows={data.sos} columns={["status","message","createdAt"]} />}
        {section === "ratings" && <DataTable title="Customer ratings" rows={data.ratings} columns={["createdAt","trip","customer","driver","vehicle","driverRating","vehicleRating","review"]} />}
        {section === "reports" && <section className="report-grid">
          {data.reports && <>
            <DataTable title="Booking report" rows={data.reports.bookings?.report || []} columns={["_id","totalBookings","totalFare"]} />
            <DataTable title="Trip report" rows={data.reports.trips?.report || []} columns={["_id","trips","distance","revenue"]} />
            <DataTable title="Payment report" rows={data.reports.payments?.report || []} columns={["_id","transactions","amount"]} />
            <DataTable title="Rating summary" rows={data.reports.ratings?.report || []} columns={["_id","count"]} />
          </>}
        </section>}
      </section>
      {detailRecord && <div className="modal-backdrop" onMouseDown={() => { setDetailRecord(null); setDetailMeta(null); }}><div className="modal-card" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => { setDetailRecord(null); setDetailMeta(null); }}><X size={18}/></button><span className="section-label">ADMIN VERIFICATION · {detailType.toUpperCase()}</span><h2>{detailRecord.fullName || detailRecord.name || detailRecord.customerId || detailRecord.driverId}</h2><KeyValueTable record={detailRecord} exclude={["password", "__v"]} />{detailMeta && <div className="report-grid">{Object.entries(detailMeta).map(([key,value]) => <article className="dashboard-card" key={key}><div className="card-heading"><h3>{key.replace(/([A-Z])/g," $1").replace(/^./,m=>m.toUpperCase())}</h3><span>{Array.isArray(value) ? `${value.length} records` : "Linked"}</span></div>{Array.isArray(value) ? <GenericRecordsTable rows={value} title={key} /> : <KeyValueTable record={value && typeof value === "object" ? value : { value }} />}</article>)}</div>}<div className="dashboard-alert success">Admin can inspect the complete profile plus linked bookings, trips and operational records here. Authentication passwords are never exposed.</div></div></div>}
      {assignBooking && <div className="modal-backdrop" onMouseDown={() => setAssignBooking(null)}><div className="modal-card" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setAssignBooking(null)}><X size={18}/></button><span className="section-label">ASSIGNMENT</span><h2>{assignBooking.bookingId || "Booking"}</h2><p className="muted-text">{assignBooking.pickupLocation} → {assignBooking.dropLocation}</p><div className="modal-grid"><label>Driver<select value={assignForm.driverId} onChange={(e)=>setAssignForm({...assignForm,driverId:e.target.value})}><option value="">Select available driver</option>{availableDrivers.map((driver)=><option key={driver._id} value={driver._id}>{driver.fullName} · {driver.driverId}</option>)}</select></label><label>Vehicle<select value={assignForm.vehicleId} onChange={(e)=>setAssignForm({...assignForm,vehicleId:e.target.value})}><option value="">Select compatible vehicle</option>{availableVehicles.map((vehicle)=><option key={vehicle._id} value={vehicle._id}>{vehicle.vehicleNumber} · {vehicle.brand} {vehicle.model}</option>)}</select></label></div><button className="dashboard-primary" onClick={manualAssign}>Assign driver & vehicle</button></div></div>}
      {modal && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><div className="modal-card" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setModal(null)}><X size={18}/></button><span className="section-label">CREATE</span><h2>{modal}</h2>{modal === "category" && <div className="modal-grid"><Field label="Name" value={form.name} onChange={(v)=>setForm({...form,name:v})}/><Field label="Code" value={form.code} onChange={(v)=>setForm({...form,code:v})}/><Field label="Pricing group" value={form.pricingGroup} onChange={(v)=>setForm({...form,pricingGroup:v})}/><Field label="Seats" type="number" value={form.seatingCapacity} onChange={(v)=>setForm({...form,seatingCapacity:v})}/></div>}{modal === "driver" && <div className="modal-grid"><Field label="Full name" value={form.fullName} onChange={(v)=>setForm({...form,fullName:v})}/><Field label="Email" type="email" value={form.email} onChange={(v)=>setForm({...form,email:v})}/><Field label="Phone" value={form.phone} onChange={(v)=>setForm({...form,phone:v})}/><Field label="Password" type="password" value={form.password} onChange={(v)=>setForm({...form,password:v})}/><Field label="License number" value={form.licenseNumber} onChange={(v)=>setForm({...form,licenseNumber:v})}/><Field label="License expiry" type="date" value={form.licenseExpiry} onChange={(v)=>setForm({...form,licenseExpiry:v})}/></div>}{modal === "coupon" && <div className="modal-grid"><Field label="Code" value={form.code} onChange={(v)=>setForm({...form,code:v.toUpperCase()})}/><Field label="Description" value={form.description} onChange={(v)=>setForm({...form,description:v})}/><label>Discount type<select value={form.discountType||"Percentage"} onChange={(e)=>setForm({...form,discountType:e.target.value})}><option>Percentage</option><option>Fixed</option></select></label><Field label="Discount value" type="number" value={form.discountValue} onChange={(v)=>setForm({...form,discountValue:v})}/><Field label="Valid from" type="datetime-local" value={form.validFrom} onChange={(v)=>setForm({...form,validFrom:v})}/><Field label="Valid until" type="datetime-local" value={form.validUntil} onChange={(v)=>setForm({...form,validUntil:v})}/></div>}<button className="dashboard-primary" onClick={createResource}>Create</button></div></div>}
    </main>
  );
};

const NavigationIcon = Activity;
const Field = ({ label, value, onChange, type = "text" }) => <label>{label}<input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} required /></label>;
const formatCell = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (value instanceof Date) return value.toLocaleString("en-IN");
  if (Array.isArray(value)) return value.map(formatCell).join(", ");
  if (typeof value === "object") {
    const preferred = ["fullName", "name", "driverId", "customerId", "vehicleId", "vehicleNumber", "tripId", "bookingId", "email", "phone", "brand", "model", "status"];
    const label = preferred.map((key) => value[key]).find((item) => item !== undefined && item !== null && item !== "");
    if (label !== undefined) return String(label);
    return Object.entries(value).filter(([key]) => key !== "_id").map(([key, item]) => `${key}: ${formatCell(item)}`).join(" · ");
  }
  if (typeof value === "string" && /^(\d{4}-\d{2}-\d{2}T)/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString("en-IN");
  }
  return String(value);
};

const KeyValueTable = ({ record, exclude = [] }) => {
  if (!record || typeof record !== "object") return null;
  const entries = Object.entries(record).filter(([key]) => !exclude.includes(key));
  return <div className="data-table-wrap"><table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>{entries.map(([key, value]) => <tr key={key}><td>{key.replace(/([A-Z])/g, " $1")}</td><td>{formatCell(value)}</td></tr>)}</tbody></table></div>;
};

const GenericRecordsTable = ({ rows, title }) => {
  if (!rows?.length) return <p className="empty-state">No records found.</p>;
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row || {})))].filter((column) => !["__v", "password"].includes(column));
  return <DataTable title={title} rows={rows} columns={columns} />;
};

const DataTable = ({ title, rows, columns, renderActions }) => <section className="dashboard-card table-card"><div className="card-heading"><h2>{title}</h2><span>{rows.length} records</span></div>{rows.length === 0 ? <p className="empty-state">No records found.</p> : <div className="data-table-wrap"><table><thead><tr>{columns.map((column)=><th key={column}>{column.replace(/([A-Z])/g, " $1").replace(/^_id$/, "ID")}</th>)}{renderActions && <th>Actions</th>}</tr></thead><tbody>{rows.map((row, index)=><tr key={row._id || `${title}-${index}`}>{columns.map((column)=><td key={column}>{formatCell(row[column])}</td>)}{renderActions && <td>{renderActions(row)}</td>}</tr>)}</tbody></table></div>}</section>;
export default AdminDashboard;
