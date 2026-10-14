import { ArrowRight, CarFront, ShieldCheck, Users } from "lucide-react";

const portals = [
  {
    role: "customer",
    title: "Customer",
    description: "Book rides, view fares, track your driver and manage trips.",
    icon: CarFront,
    url: "/customer",
  },
  {
    role: "driver",
    title: "Driver",
    description: "View assigned trips, verify OTP, share GPS and update trip status.",
    icon: Users,
    url: "/driver",
  },
  {
    role: "admin",
    title: "Admin",
    description: "Manage customers, drivers, vehicles, bookings, pricing and reports.",
    icon: ShieldCheck,
    url: "/admin",
  },
];

export default function RoleSelector() {
  return (
    <main className="portal-selector-page">
      <section className="portal-selector-card">
        <div className="portal-selector-head">
          <div className="brand portal-brand">
            <div className="brand-mark"><CarFront size={20} /></div>
            <div className="brand-text"><span>travels</span><small>CAB</small></div>
          </div>
          <span className="section-label">SECURE PORTAL ACCESS</span>
          <h1>Who are you logging in as?</h1>
          <p>Choose your Travels Cab portal. Customer, Driver and Admin are available in this application.</p>
        </div>

        <div className="portal-grid">
          {portals.map(({ title, description, icon: Icon, url }) => (
            <a className="portal-card" href={url} key={title}>
              <div className="portal-icon"><Icon size={24} /></div>
              <div className="portal-card-copy">
                <span className="section-label">PORTAL</span>
                <h2>{title}</h2>
                <p>{description}</p>
              </div>
              <ArrowRight className="portal-arrow" size={20} />
            </a>
          ))}
        </div>

        <div className="portal-host-row">
          <span>Customer · /customer</span>
          <span>Driver · /driver</span>
          <span>Admin · /admin</span>
        </div>
      </section>
    </main>
  );
}
