import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ==================================================
  // LOAD CURRENT USER
  // ==================================================

  const loadUser = async () => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    const storedUser = localStorage.getItem("user");

    // No token
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    // ==================================================
    // ADMIN
    // ==================================================

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

          localStorage.setItem(
            "user",
            JSON.stringify(adminUser)
          );
        }
      } catch (error) {
        console.error("Load admin error:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }

      return;
    }

    // ==================================================
    // EMPLOYEE
    // ==================================================

    try {
      const response = await api.get("/employees/me");

      setUser(response.data);

      localStorage.setItem(
        "user",
        JSON.stringify(response.data)
      );
    } catch (error) {
      console.error("Load user error:", error);

      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("user");

      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // ==================================================
  // INITIAL LOAD
  // ==================================================

  useEffect(() => {
    loadUser();
  }, []);

  // ==================================================
  // LOGIN
  // ==================================================

  const login = async (email, password) => {
    const response = await api.post("/auth/login", {
      email,
      password,
    });

    const token = response.data.access_token;
    const role = response.data.role;

    if (!token) {
      throw new Error("Login response did not contain an access token.");
    }

    // Save authentication
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);

    // ==================================================
    // ADMIN LOGIN
    // ==================================================

    if (role === "admin") {
      const adminUser = {
        id: response.data.id || null,

        employee_id:
          response.data.employee_id ||
          "ADMIN001",

        full_name:
          response.data.full_name ||
          "System Administrator",

        email:
          response.data.email ||
          email,

        role: "admin",

        status: "active",

        is_active: true,

        department:
          response.data.department ||
          "Administration",

        designation:
          response.data.designation ||
          "System Administrator",

        directory_name:
          response.data.directory_name ||
          "admin",
      };

      setUser(adminUser);

      localStorage.setItem(
        "user",
        JSON.stringify(adminUser)
      );
    }

    // ==================================================
    // EMPLOYEE LOGIN
    // ==================================================

    else {
      const profile = await api.get("/employees/me");

      setUser(profile.data);

      localStorage.setItem(
        "user",
        JSON.stringify(profile.data)
      );
    }

    return response.data;
  };

  // ==================================================
  // LOGOUT
  // ==================================================

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");

    setUser(null);
  };

  // ==================================================
  // CONTEXT
  // ==================================================

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

// ==================================================
// USE AUTH
// ==================================================

export function useAuth() {
  return useContext(AuthContext);
}