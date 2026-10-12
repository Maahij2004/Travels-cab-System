import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getCurrentUser, loginUser, registerCustomer } from "../services/authService";

const TOKEN_KEY = "travels_token";
const USER_KEY = "travels_user";
const AuthContext = createContext(null);

const clearStoredAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearStoredAuth();
    setUser(null);
  }, []);

  const loadUser = useCallback(async () => {
    try {
      const response = await getCurrentUser();
      setUser(response.user);
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return undefined;
    }
    loadUser();
    return undefined;
  }, [loadUser]);

  useEffect(() => {
    const handleUnauthorized = () => logout();
    window.addEventListener("travels:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("travels:unauthorized", handleUnauthorized);
  }, [logout]);

  const login = async (email, password) => {
    const response = await loginUser({ email, password });
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    setUser(response.user);
    return response;
  };

  const register = async (data) => {
    const response = await registerCustomer(data);
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    setUser(response.user);
    return response;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAuthenticated: Boolean(user) }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
