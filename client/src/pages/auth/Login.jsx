import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const PORTAL_ROLE = import.meta.env.VITE_PORTAL_ROLE || "portal";
const portalMeta = {
  customer: { title: "Customer login", label: "CUSTOMER PORTAL", description: "Book, track and manage your journeys.", expected: ["customer"], home: "/customer" },
  driver: { title: "Driver login", label: "DRIVER PORTAL", description: "Manage assigned trips and live trip operations.", expected: ["driver"], home: "/driver" },
  admin: { title: "Admin login", label: "ADMIN PORTAL", description: "Control bookings, people, vehicles and reports.", expected: ["admin", "superadmin"], home: "/admin" },
};

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const pathRole = location.pathname.split("/")[1];
  const activeRole = PORTAL_ROLE === "portal" && portalMeta[pathRole] ? pathRole : PORTAL_ROLE;
  const meta = portalMeta[activeRole] || {
    title: "Sign in",
    label: "TRAVELS CAB",
    description: "Sign in to continue your journey.",
    expected: [],
    home: "/",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await login(email, password);
      const role = response.user.role;
      if (meta.expected.length && !meta.expected.includes(role)) {
        logout();
        throw new Error(`This is the ${meta.title.toLowerCase()} portal. Please use the correct portal for your account.`);
      }
      navigate(meta.home, { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Unable to login. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const goPortalSelector = () => navigate("/");

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="section-label">{meta.label}</span>
          <h1>{meta.title}.</h1>
          <p>{meta.description}</p>
        </div>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></div>
          <div className="form-group"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required /></div>
          <button type="submit" className="auth-submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}{!loading && <ArrowRight size={18} />}</button>
        </form>
        {activeRole === "customer" && <p className="auth-footer">New to Travels? <button type="button" onClick={() => navigate("/register")}>Create an account</button></p>}
        <button type="button" className="portal-switch-link" onClick={goPortalSelector}>← Choose a different portal</button>
      </div>
    </div>
  );
};

export default Login;
