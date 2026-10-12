import { Route, Routes, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import DriverDashboard from "./pages/driver/DriverDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import SharedTrip from "./pages/SharedTrip";
import RoleSelector from "./pages/RoleSelector";
import { useAuth } from "./context/AuthContext";

const PORTAL_ROLE = import.meta.env.VITE_PORTAL_ROLE || "portal";

const ROLE_CONFIG = {
  customer: { label: "Customer", path: "/customer", roles: ["customer"], dashboard: CustomerDashboard },
  driver: { label: "Driver", path: "/driver", roles: ["driver"], dashboard: DriverDashboard },
  admin: { label: "Admin", path: "/admin", roles: ["admin", "superadmin"], dashboard: AdminDashboard },
};

const Unauthorized = () => (
  <main className="simple-page">
    <div className="simple-card">
      <span className="section-label">TRAVELS CAB</span>
      <h1>Access restricted.</h1>
      <p>Your account does not have permission to open this portal.</p>
      <a className="auth-submit simple-link" href="http://localhost:5173/">Choose another portal</a>
    </div>
  </main>
);

const NotFound = () => (
  <main className="simple-page">
    <div className="simple-card">
      <span className="section-label">404</span>
      <h1>Page not found.</h1>
      <p>The page you requested does not exist on this portal.</p>
      <a className="auth-submit simple-link" href="/">Return home</a>
    </div>
  </main>
);

function RoleLanding({ role }) {
  const { user, loading } = useAuth();
  const config = ROLE_CONFIG[role];

  if (!config) return <RoleSelector />;
  if (loading) return <div className="page-loading">Loading...</div>;
  if (!user) return <Login />;

  return (
    <ProtectedRoute allowedRoles={config.roles}>
      <config.dashboard />
    </ProtectedRoute>
  );
}

function App() {
  if (PORTAL_ROLE === "portal") {
    return (
      <Routes>
        <Route path="/" element={<RoleSelector />} />
        <Route path="/shared-trip/:token" element={<SharedTrip />} />
        <Route path="*" element={<RoleSelector />} />
      </Routes>
    );
  }

  const config = ROLE_CONFIG[PORTAL_ROLE] || ROLE_CONFIG.customer;

  return (
    <Routes>
      <Route path="/" element={<RoleLanding role={PORTAL_ROLE} />} />
      <Route path="/login" element={<Login />} />
      {PORTAL_ROLE === "customer" && <Route path="/register" element={<Register />} />}
      <Route
        path="/customer/*"
        element={
          <ProtectedRoute allowedRoles={config.roles}>
            <CustomerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/driver/*"
        element={
          <ProtectedRoute allowedRoles={config.roles}>
            <DriverDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={config.roles}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/shared-trip/:token" element={<SharedTrip />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
