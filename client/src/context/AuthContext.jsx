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
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  });
  const [loading, setLoading] = useState(() => !localStorage.getItem(USER_KEY));

  const logout = useCallback(() => {
    clearStoredAuth();
    setUser(null);
  }, []);

  const loadUser = useCallback(async () => {
    try {
      const response = await getCurrentUser();
      setUser(response.user);
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    } catch (error) {
      // A temporary network/Render cold-start failure should not log the driver
      // out when a valid cached session already exists. The API interceptor
      // still handles a real 401 and clears the session.
      if ([401, 403].includes(error.response?.status)) logout();
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

    // Use the cached identity immediately so portal navigation does not wait
    // for /auth/me. The API still validates the token in the background.
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
