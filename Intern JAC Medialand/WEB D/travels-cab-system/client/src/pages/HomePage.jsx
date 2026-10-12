import {
  ArrowRight,
  ArrowUpRight,
  CarFront,
  Menu,
  Navigation,
  Plane,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import BookingPanel from "../components/booking/BookingPanel";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

const carImages = {
  hero: "https://images.unsplash.com/photo-1664786235103-b0922d5a6a54?auto=format&fit=crop&fm=jpg&q=82&w=1600",
  mini: "https://images.unsplash.com/photo-1573119059018-5c0349b783b2?auto=format&fit=crop&fm=jpg&q=82&w=1200",
  sedan: "https://images.unsplash.com/photo-1571775145685-931acf18b912?auto=format&fit=crop&fm=jpg&q=82&w=1200",
  suv: "https://images.unsplash.com/photo-1568479084617-9e3a928bf4e9?auto=format&fit=crop&fm=jpg&q=82&w=1200",
  premium: "https://images.unsplash.com/photo-1662364519363-e8dc7a8726d8?auto=format&fit=crop&fm=jpg&q=82&w=1200",
};
const services = [
  {
    icon: CarFront,
    title: "City Rides",
    description: "Comfortable everyday travel across the city.",
  },
  {
    icon: Plane,
    title: "Airport Transfers",
    description: "Reliable pickups and drop-offs without the hassle.",
  },
  {
    icon: Navigation,
    title: "Outstation",
    description: "Long-distance journeys planned around your comfort.",
  },
  {
    icon: Users,
    title: "Corporate Travel",
    description: "Dependable travel solutions for teams and businesses.",
  },
];

const vehicles = [
  {
    name: "Mini",
    description: "Smart and economical city travel",
    seats: "4 Seats",
    luggage: "1–2 Bags",
    className: "vehicle-mini",
    image: "mini",
  },
  {
    name: "Sedan",
    description: "Comfortable everyday journeys",
    seats: "4 Seats",
    luggage: "2–3 Bags",
    className: "vehicle-sedan",
    image: "sedan",
  },
  {
    name: "SUV",
    description: "More space for family journeys",
    seats: "6 Seats",
    luggage: "4 Bags",
    className: "vehicle-suv",
    image: "suv",
  },
  {
    name: "Premium",
    description: "Refined travel with a luxury finish",
    seats: "4 Seats",
    luggage: "3 Bags",
    className: "vehicle-premium",
    image: "premium",
  },
];

function HomePage() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="app">

      {/* NAVBAR */}
      <header className="navbar">
        <div className="nav-inner">

          <Link to="/" className="brand">
            <div className="brand-mark">
              <Navigation size={20} strokeWidth={2.4} />
            </div>

            <div className="brand-text">
              <span>travels</span>
              <small>CAB</small>
            </div>
          </Link>

          <nav className="desktop-nav">
            <a href="#home" className="active">
              Home
            </a>
            <a href="#services">Services</a>
            <a href="#vehicles">Vehicles</a>
            <a href="#about">About</a>
            <a href="#support">Support</a>
          </nav>

          <div className="nav-actions">
            <button className="signin-button" onClick={() => navigate("/login")}>
              Sign in
            </button>

            <button className="nav-book-button" onClick={() => navigate("/customer/book")}>
              Book a ride
              <ArrowUpRight size={16} />
            </button>
          </div>

          <button className="mobile-menu" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}>
            <Menu size={23} />
          </button>

          {mobileOpen && (
            <nav className="mobile-nav" aria-label="Mobile navigation">
              <a href="#home" onClick={() => setMobileOpen(false)}>Home</a>
              <a href="#services" onClick={() => setMobileOpen(false)}>Services</a>
              <a href="#vehicles" onClick={() => setMobileOpen(false)}>Vehicles</a>
              <a href="#about" onClick={() => setMobileOpen(false)}>About</a>
              <a href="#support" onClick={() => setMobileOpen(false)}>Support</a>
              <button type="button" onClick={() => navigate("/login")}>Sign in</button>
            </nav>
          )}

        </div>
      </header>


      {/* HERO */}
      <main id="home">

        <section className="hero">

          <div className="hero-inner">

            {/* LEFT CONTENT */}
            <div className="hero-content">

              <div className="eyebrow">
                <span className="eyebrow-dot" />
                TRAVEL MADE SIMPLE
              </div>

              <h1>
                Good journeys
                <br />
                create
                <span> better days.</span>
              </h1>

              <p className="hero-description">
                Reliable rides, comfortable travel and a smoother
                way to reach every destination.
              </p>

              <div className="hero-buttons">
                <button className="primary-button" onClick={() => navigate("/customer/book")}>
                  Book a ride
                  <span>
                    <ArrowRight size={17} />
                  </span>
                </button>

                <button className="secondary-button" onClick={() => document.getElementById("services")?.scrollIntoView({ behavior: "smooth" })}>
                  Explore services
                  <ArrowRight size={17} />
                </button>
              </div>

              <div className="trust-row">

                <div className="trust-item">
                  <div className="trust-icon">
                    <ShieldCheck size={18} />
                  </div>

                  <div>
                    <strong>24/7</strong>
                    <small>Booking access</small>
                  </div>
                </div>

                <div className="trust-divider" />

                <div className="trust-item">
                  <div className="trust-icon">
                    <Sparkles size={18} />
                  </div>

                  <div>
                    <strong>4.8/5</strong>
                    <small>Rider rating</small>
                  </div>
                </div>

                <div className="trust-divider" />

                <div className="trust-item">
                  <div className="trust-icon">
                    <Navigation size={18} />
                  </div>

                  <div>
                    <strong>Live</strong>
                    <small>Trip tracking</small>
                  </div>
                </div>

              </div>

            </div>


            {/* RIGHT SIDE */}
            <div className="hero-visual">

              <div className="visual-glow glow-one" />
              <div className="visual-glow glow-two" />

              <div className="travel-image">

                <div className="image-overlay" />

                <div className="destination-label">
                  <small>YOUR NEXT JOURNEY</small>
                  <strong>AWAITS.</strong>
                </div>

                <div className="road-line" />

                <div className="visual-circle circle-one" />
                <div className="visual-circle circle-two" />

                <img
                  className="hero-car-photo"
                  src={carImages.hero}
                  alt="Luxury car travelling on a road"
                  loading="eager"
                  referrerPolicy="no-referrer"
                />

              </div>

              <BookingPanel />



            </div>

          </div>

        </section>


        {/* SERVICES */}
        <section id="services" className="services-section">

          <div className="section-container">

            <div className="section-heading">

              <div>
                <span className="section-label">
                  OUR SERVICES
                </span>

                <h2>
                  Travel your way.
                </h2>
              </div>

              <p>
                From everyday city rides to long-distance journeys,
                choose a travel experience designed around you.
              </p>

            </div>


            <div className="services-grid">

              {services.map((service) => {
                const Icon = service.icon;

                return (
                  <article className="service-card" key={service.title}>

                    <div className="service-icon">
                      <Icon size={21} />
                    </div>

                    <div className="service-number">
                      0{services.indexOf(service) + 1}
                    </div>

                    <h3>{service.title}</h3>

                    <p>{service.description}</p>

                    <button className="service-arrow">
                      <ArrowUpRight size={17} />
                    </button>

                  </article>
                );
              })}

            </div>

          </div>

        </section>


        {/* VEHICLES */}
        <section id="vehicles" className="vehicles-section">

          <div className="section-container">

            <div className="section-heading">

              <div>
                <span className="section-label">
                  OUR FLEET
                </span>

                <h2>
                  Choose your ride.
                </h2>
              </div>

              <button className="view-all">
                View all vehicles
                <ArrowRight size={17} />
              </button>

            </div>


            <div className="vehicles-grid">

              {vehicles.map((vehicle) => (

                <article
                  className={`vehicle-card ${vehicle.className}`}
                  key={vehicle.name}
                >

                  <div className="vehicle-top">
                    <span>TRAVELS</span>
                    <span>01</span>
                  </div>

                  <div className="vehicle-art">
                    <img
                      className="vehicle-photo"
                      src={carImages[vehicle.image]}
                      alt={`${vehicle.name} vehicle`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div className="vehicle-info">

                    <div>
                      <h3>{vehicle.name}</h3>
                      <p>{vehicle.description}</p>
                    </div>

                  </div>

                  <div className="vehicle-meta">
                    <span>{vehicle.seats}</span>
                    <span>{vehicle.luggage}</span>
                    <span>AC</span>
                  </div>

                </article>

              ))}

            </div>

          </div>

        </section>


        {/* WHY TRAVELS */}
        <section id="about" className="why-section">

          <div className="section-container">

            <div className="why-grid">

              <div className="why-content">

                <span className="section-label">
                  WHY TRAVELS
                </span>

                <h2>
                  More than getting
                  <span> from A to B.</span>
                </h2>

                <p>
                  Every part of your journey should feel clear,
                  comfortable and dependable. Travels keeps your
                  booking, driver, vehicle and trip information
                  connected in one place.
                </p>

                <button className="dark-button">
                  Discover Travels
                  <ArrowUpRight size={17} />
                </button>

              </div>


              <div className="why-features">

                <div className="why-feature">
                  <span>01</span>

                  <div>
                    <h3>Transparent travel</h3>
                    <p>
                      Clear booking details and fare information
                      before your journey begins.
                    </p>
                  </div>
                </div>

                <div className="why-feature">
                  <span>02</span>

                  <div>
                    <h3>Connected trips</h3>
                    <p>
                      Follow your booking from confirmation
                      through trip completion.
                    </p>
                  </div>
                </div>

                <div className="why-feature">
                  <span>03</span>

                  <div>
                    <h3>Built around people</h3>
                    <p>
                      A better experience for customers,
                      drivers and administrators.
                    </p>
                  </div>
                </div>

              </div>

            </div>

          </div>

        </section>


        {/* FOOTER */}
        <footer id="support" className="footer">

          <div className="section-container footer-inner">

            <div className="footer-brand">

              <div className="brand">
                <div className="brand-mark">
                  <Navigation size={19} />
                </div>

                <div className="brand-text">
                  <span>travels</span>
                  <small>CAB</small>
                </div>
              </div>

              <p>
                Thoughtfully arranged journeys,
                wherever you're going.
              </p>

            </div>

            <div className="footer-links">
              <a href="#services">Services</a>
              <a href="#vehicles">Vehicles</a>
              <a href="#about">About</a>
              <a href="#support">Support</a>
            </div>

          </div>

        </footer>

      </main>
    </div>
  );
}

export default HomePage;