import { useCallback, useEffect, useState } from "react";
import { Activity, BarChart3, CarFront, ClipboardList, DollarSign, FileBarChart, LogOut, Megaphone, Plus, RefreshCw, Settings2, ShieldAlert, Ticket, UserCog, Users, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

const sections = [
  ["overview", "Dashboard", Activity], ["bookings", "Bookings", ClipboardList], ["drivers", "Drivers", UserCog], ["vehicles", "Vehicles", CarFront], ["customers", "Customers", Users], ["categories", "Categories", Settings2], ["pricing", "Pricing", DollarSign], ["coupons", "Coupons", Ticket], ["payments", "Payments", DollarSign], ["reports", "Reports", FileBarChart], ["support", "Support", Megaphone], ["safety", "SOS", ShieldAlert],
];

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [section, setSection] = useState("overview");
  const [stats, setStats] = useState(null);
  const [data, setData] = useState({ bookings: [], drivers: [], vehicles: [], customers: [], categories: [], pricing: [], coupons: [], payments: [], tickets: [], sos: [], reports: null });
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

  const request = async (path, options = {}) => { const response = await api({ url: path, ...options }); return response.data; };

  const load = useCallback(async () => {
    setError("");
    try {
      const [dashboard, bookings, drivers, vehicles, customers, categories] = await Promise.all([
        request("/dashboard/stats"), request("/bookings"), request("/drivers"), request("/vehicles"), request("/customers"), request("/vehicle-categories"),
      ]);
      setStats(dashboard.dashboard); setData((current) => ({ ...current, bookings: bookings.bookings || [], drivers: drivers.drivers || [], vehicles: vehicles.vehicles || [], customers: customers.customers || [], categories: categories.categories || [] }));
    } catch (err) { setError(err.response?.data?.message || "Unable to load administration data."); }

  }, []);

  const loadSection = useCallback(async (name) => {
    try {
      if (name === "pricing") { const value = await request("/pricing"); setData((d) => ({ ...d, pricing: value.pricing || [] })); }
      if (name === "coupons") { const value = await request("/coupons"); setData((d) => ({ ...d, coupons: value.coupons || [] })); }
      if (name === "payments") { const value = await request("/payments"); setData((d) => ({ ...d, payments: value.payments || [] })); }
      if (name === "support") { const value = await request("/support"); setData((d) => ({ ...d, tickets: value.tickets || [] })); }
      if (name === "safety") { const safety = await request("/SOS"); setData((d) => ({ ...d, sos: safety.alerts || safety.sos || safety.SOS || [] })); }
      if (name === "reports") {
        const [b, t, p, r] = await Promise.all([request("/reports/bookings"), request("/reports/trips"), request("/reports/payments"), request("/reports/ratings")]);
        setData((d) => ({ ...d, reports: { bookings: b, trips: t, payments: p, ratings: r } }));
      }
    } catch (err) { setError(err.response?.data?.message || `Unable to load ${name}.`); }
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
        {section === "drivers" && <><div className="section-actions"><button className="dashboard-primary compact" onClick={() => { setModal("driver"); setForm({}); }}><Plus size={15}/> Add driver</button></div><DataTable title="Drivers" rows={data.drivers} columns={["driverId","fullName","phone","status"]} renderActions={(row) => <div className="table-actions"><button onClick={() => openDetails("driver", row._id)}>View details</button><button onClick={() => updateDriverStatus(row._id,"Available")}>Available</button><button onClick={() => updateDriverStatus(row._id,"On Leave")}>Leave</button></div>} /></>}
        {section === "vehicles" && <DataTable title="Vehicles" rows={data.vehicles} columns={["vehicleId","vehicleNumber","brand","model","status"]} renderActions={(row) => <div className="table-actions"><button onClick={() => updateVehicleStatus(row._id,"Available")}>Available</button><button onClick={() => updateVehicleStatus(row._id,"Under Maintenance")}>Maintenance</button></div>} />}
        {section === "customers" && <DataTable title="Customers" rows={data.customers} columns={["customerId","fullName","email","phone"]} renderActions={(row) => <div className="table-actions"><button onClick={() => openDetails("customer", row._id)}>View full profile</button></div>} />}
        {section === "categories" && <><div className="section-actions"><button className="dashboard-primary compact" onClick={() => { setModal("category"); setForm({}); }}><Plus size={15}/> Add category</button></div><DataTable title="Vehicle categories" rows={data.categories} columns={["name","code","pricingGroup","seatingCapacity","isActive"]} /></>}
        {section === "pricing" && <DataTable title="Pricing rules" rows={data.pricing} columns={["name","pricingGroup","baseFare","perKmRate","minimumFare","isActive"]} />}
        {section === "coupons" && <><div className="section-actions"><button className="dashboard-primary compact" onClick={() => { setModal("coupon"); setForm({ discountType:"Percentage" }); }}><Plus size={15}/> Add coupon</button></div><DataTable title="Coupons" rows={data.coupons} columns={["code","discountType","discountValue","validFrom","validUntil","isActive"]} /></>}
        {section === "payments" && <DataTable title="Payments" rows={data.payments} columns={["paymentId","method","amount","status"]} />}
        {section === "support" && <DataTable title="Support tickets" rows={data.tickets} columns={["subject","status","priority","createdAt"]} />}
        {section === "safety" && <DataTable title="SOS alerts" rows={data.sos} columns={["status","message","createdAt"]} />}
        {section === "reports" && <section className="report-grid">{data.reports && Object.entries(data.reports).map(([key,value]) => <article className="dashboard-card" key={key}><span className="section-label">{key.toUpperCase()}</span><pre>{JSON.stringify(value, null, 2)}</pre></article>)}</section>}
      </section>
      {detailRecord && <div className="modal-backdrop" onMouseDown={() => { setDetailRecord(null); setDetailMeta(null); }}><div className="modal-card" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => { setDetailRecord(null); setDetailMeta(null); }}><X size={18}/></button><span className="section-label">ADMIN VERIFICATION · {detailType.toUpperCase()}</span><h2>{detailRecord.fullName || detailRecord.name || detailRecord.customerId || detailRecord.driverId}</h2><div className="modal-grid">{Object.entries(detailRecord).filter(([key]) => !["password","__v"].includes(key)).map(([key,value]) => <div key={key}><small className="section-label">{key}</small><p className="muted-text">{value && typeof value === "object" ? (value._id ? `${value._id}` : JSON.stringify(value, null, 2)) : String(value ?? "—")}</p></div>)}</div>{detailMeta && <div className="report-grid">{Object.entries(detailMeta).map(([key,value]) => <article className="dashboard-card" key={key}><div className="card-heading"><h3>{key.replace(/([A-Z])/g," $1").replace(/^./,m=>m.toUpperCase())}</h3><span>{Array.isArray(value) ? `${value.length} records` : "Linked"}</span></div>{Array.isArray(value) ? (value.length ? <pre>{JSON.stringify(value, null, 2)}</pre> : <p className="empty-state">No records found.</p>) : <pre>{JSON.stringify(value, null, 2)}</pre>}</article>)}</div>}<div className="dashboard-alert success">Admin can inspect the complete profile plus linked bookings, trips and operational records here. Authentication passwords are never exposed.</div></div></div>}
      {assignBooking && <div className="modal-backdrop" onMouseDown={() => setAssignBooking(null)}><div className="modal-card" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setAssignBooking(null)}><X size={18}/></button><span className="section-label">ASSIGNMENT</span><h2>{assignBooking.bookingId || "Booking"}</h2><p className="muted-text">{assignBooking.pickupLocation} → {assignBooking.dropLocation}</p><div className="modal-grid"><label>Driver<select value={assignForm.driverId} onChange={(e)=>setAssignForm({...assignForm,driverId:e.target.value})}><option value="">Select available driver</option>{availableDrivers.map((driver)=><option key={driver._id} value={driver._id}>{driver.fullName} · {driver.driverId}</option>)}</select></label><label>Vehicle<select value={assignForm.vehicleId} onChange={(e)=>setAssignForm({...assignForm,vehicleId:e.target.value})}><option value="">Select compatible vehicle</option>{availableVehicles.map((vehicle)=><option key={vehicle._id} value={vehicle._id}>{vehicle.vehicleNumber} · {vehicle.brand} {vehicle.model}</option>)}</select></label></div><button className="dashboard-primary" onClick={manualAssign}>Assign driver & vehicle</button></div></div>}
      {modal && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><div className="modal-card" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setModal(null)}><X size={18}/></button><span className="section-label">CREATE</span><h2>{modal}</h2>{modal === "category" && <div className="modal-grid"><Field label="Name" value={form.name} onChange={(v)=>setForm({...form,name:v})}/><Field label="Code" value={form.code} onChange={(v)=>setForm({...form,code:v})}/><Field label="Pricing group" value={form.pricingGroup} onChange={(v)=>setForm({...form,pricingGroup:v})}/><Field label="Seats" type="number" value={form.seatingCapacity} onChange={(v)=>setForm({...form,seatingCapacity:v})}/></div>}{modal === "driver" && <div className="modal-grid"><Field label="Full name" value={form.fullName} onChange={(v)=>setForm({...form,fullName:v})}/><Field label="Email" type="email" value={form.email} onChange={(v)=>setForm({...form,email:v})}/><Field label="Phone" value={form.phone} onChange={(v)=>setForm({...form,phone:v})}/><Field label="Password" type="password" value={form.password} onChange={(v)=>setForm({...form,password:v})}/><Field label="License number" value={form.licenseNumber} onChange={(v)=>setForm({...form,licenseNumber:v})}/><Field label="License expiry" type="date" value={form.licenseExpiry} onChange={(v)=>setForm({...form,licenseExpiry:v})}/></div>}{modal === "coupon" && <div className="modal-grid"><Field label="Code" value={form.code} onChange={(v)=>setForm({...form,code:v.toUpperCase()})}/><Field label="Description" value={form.description} onChange={(v)=>setForm({...form,description:v})}/><label>Discount type<select value={form.discountType||"Percentage"} onChange={(e)=>setForm({...form,discountType:e.target.value})}><option>Percentage</option><option>Fixed</option></select></label><Field label="Discount value" type="number" value={form.discountValue} onChange={(v)=>setForm({...form,discountValue:v})}/><Field label="Valid from" type="datetime-local" value={form.validFrom} onChange={(v)=>setForm({...form,validFrom:v})}/><Field label="Valid until" type="datetime-local" value={form.validUntil} onChange={(v)=>setForm({...form,validUntil:v})}/></div>}<button className="dashboard-primary" onClick={createResource}>Create</button></div></div>}
    </main>
  );
};

const NavigationIcon = Activity;
const Field = ({ label, value, onChange, type = "text" }) => <label>{label}<input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} required /></label>;
const DataTable = ({ title, rows, columns, renderActions }) => <section className="dashboard-card table-card"><div className="card-heading"><h2>{title}</h2><span>{rows.length} records</span></div>{rows.length === 0 ? <p className="empty-state">No records found.</p> : <div className="data-table-wrap"><table><thead><tr>{columns.map((column)=><th key={column}>{column}</th>)}{renderActions && <th>Actions</th>}</tr></thead><tbody>{rows.map((row)=><tr key={row._id}>{columns.map((column)=><td key={column}>{typeof row[column] === "object" ? JSON.stringify(row[column]) : String(row[column] ?? "—")}</td>)}{renderActions && <td>{renderActions(row)}</td>}</tr>)}</tbody></table></div>}</section>;
export default AdminDashboard;
