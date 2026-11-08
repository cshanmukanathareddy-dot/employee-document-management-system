import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    const storedUser = localStorage.getItem("user");

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    if (role === "admin") {
      try {
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        } else {
          const adminUser = {
            id: null,
            employee_id: "ADMIN001",
            full_name: "System Administrator",
            email: "",
            role: "admin",
            status: "active",
            is_active: true,
            department: "Administration",
            designation: "System Administrator",
            directory_name: "admin",
          };
          setUser(adminUser);
          localStorage.setItem("user", JSON.stringify(adminUser));
        }
      } catch (error) {
        console.error("Load admin error:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Paint the cached profile immediately so the application does not wait
    // for a Render round-trip before showing the workspace. The API refresh
    // below remains authoritative and replaces stale data in the background.
    let hasCachedUser = false;
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed && typeof parsed === "object") {
          setUser(parsed);
          hasCachedUser = true;
          setLoading(false);
        }
      } catch {
        // Ignore malformed cached profile and fetch a fresh one below.
      }
    }

    try {
      const response = await api.get("/employees/me");
      setUser(response.data);
      localStorage.setItem("user", JSON.stringify(response.data));
    } catch (error) {
      console.error("Load user error:", error);
      if (error?.response?.status === 401 || error?.response?.status === 403 || !hasCachedUser) {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("user");
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const login = async (email, password) => {
    const response = await api.post("/auth/login", { email, password });
    const token = response.data.access_token;
    const role = response.data.role;

    if (!token) {
      throw new Error("Login response did not contain an access token.");
    }

    localStorage.setItem("token", token);
    localStorage.setItem("role", role);

    if (role === "admin") {
      const adminUser = {
        id: response.data.id || null,
        employee_id: response.data.employee_id || "ADMIN001",
        full_name: response.data.full_name || "System Administrator",
        email: response.data.email || email,
        role: "admin",
        status: "active",
        is_active: true,
        department: response.data.department || "Administration",
        designation: response.data.designation || "System Administrator",
        directory_name: response.data.directory_name || "admin",
      };
      setUser(adminUser);
      localStorage.setItem("user", JSON.stringify(adminUser));
    } else {
      const profile = await api.get("/employees/me");
      setUser(profile.data);
      localStorage.setItem("user", JSON.stringify(profile.data));
    }

    return response.data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshUser: loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}