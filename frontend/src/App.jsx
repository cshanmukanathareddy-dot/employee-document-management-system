import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";

import ProtectedRoute from "./routes/ProtectedRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Documents from "./pages/Documents";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import AdminDocuments from "./pages/AdminDocuments";
import RegistrationRequests from "./pages/RegistrationRequests";
import StorageRequests from "./pages/StorageRequests";
import PublicDocument from "./pages/PublicDocument";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>

            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Authenticated employee routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/profile" element={<Profile />} />
            </Route>

            {/* Authenticated admin routes */}
            <Route element={<ProtectedRoute adminOnly />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route
                path="/admin/documents"
                element={<AdminDocuments />}
              />
              <Route
                path="/admin/requests"
                element={<RegistrationRequests />}
              />
              <Route
                path="/admin/storage-requests"
                element={<StorageRequests />}
              />
            </Route>

            {/* Public share-token viewers stay on the Vercel/custom domain. */}
            <Route
              path="/share/:shareType/:token"
              element={<PublicDocument />}
            />

            {/* Clean public document URLs.
                Example: /rahul_123/index.html */}
            <Route
              path="/:directory/*"
              element={<PublicDocument />}
            />

            {/* Default route */}
            <Route
              path="/"
              element={<Navigate to="/login" replace />}
            />

            {/* Unknown routes */}
            <Route
              path="*"
              element={<Navigate to="/login" replace />}
            />

          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}