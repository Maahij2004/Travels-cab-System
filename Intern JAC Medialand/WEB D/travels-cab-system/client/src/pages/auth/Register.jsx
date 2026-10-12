import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(form);
      navigate("/customer", { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to create your account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="section-label">TRAVELS CAB</span>
          <h1>Start travelling.</h1>
          <p>Create a customer account and manage your journeys in one place.</p>
        </div>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <form onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="register-name">Full name</label>
            <input id="register-name" value={form.name} onChange={(e) => update("name", e.target.value)} autoComplete="name" required />
          </div>
          <div className="form-group">
            <label htmlFor="register-email">Email</label>
            <input id="register-email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} autoComplete="email" required />
          </div>
          <div className="form-group">
            <label htmlFor="register-phone">Phone</label>
            <input id="register-phone" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} autoComplete="tel" required />
          </div>
          <div className="form-group">
            <label htmlFor="register-password">Password</label>
            <input id="register-password" type="password" value={form.password} onChange={(e) => update("password", e.target.value)} minLength={8} autoComplete="new-password" required />
          </div>
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <p className="auth-footer">
          Already registered? <button type="button" onClick={() => navigate("/login")}>Sign in</button>
        </p>
      </div>
    </main>
  );
};

export default Register;
