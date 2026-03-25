import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./components/authCore";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Applications from "./components/Applications";
import Environments from "./components/Environments";
import Logs from "./components/Logs";
import Users from "./components/Users";
import APIKeys from "./components/APIKeys";
import AppLayout from "./components/AppLayout";

function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" /> : <Login />}
      />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/environments" element={<Environments />} />
        <Route path="/logs" element={<Logs />} />
        <Route
          path="/users"
          element={
            <ProtectedRoute requiredRole="admin">
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="/apikeys"
          element={
            <ProtectedRoute requiredRole="admin">
              <APIKeys />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Route>
    </Routes>
  );
}

export default App;
