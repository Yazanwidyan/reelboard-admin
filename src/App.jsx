import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";

import { get, getToken, setToken } from "./api";
import { Brand } from "./components/Logo";
import { ClubDetail } from "./pages/ClubDetail";
import { Clubs } from "./pages/Clubs";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { MovieEdit } from "./pages/MovieEdit";
import { Movies } from "./pages/Movies";
import { SagaEdit } from "./pages/SagaEdit";
import { Sagas } from "./pages/Sagas";
import { UserDetail } from "./pages/UserDetail";
import { Users } from "./pages/Users";

const NAV = [
  ["/", "Dashboard"],
  ["/users", "Users"],
  ["/movies", "Movies & vibes"],
  ["/collections", "Collections"],
  ["/clubs", "Clubs"],
];

// Follows the stored token (signing in, signing out, or a 401 clearing it).
const useToken = () => {
  const [token, setState] = useState(getToken);
  useEffect(() => {
    const update = () => setState(getToken());
    window.addEventListener("admin-token", update);
    return () => window.removeEventListener("admin-token", update);
  }, []);
  return token;
};

export const App = () => {
  const token = useToken();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["admin", "me", token], queryFn: () => get("/admin/me"), enabled: Boolean(token) });

  const signOut = () => {
    setToken(null);
    queryClient.clear();
  };

  if (!token) return <Login />;
  if (me.isPending) return <div className="login muted">Checking your account…</div>;
  if (me.isError) {
    return (
      <div className="login">
        <div className="card">
          <h1>{me.error.status === 403 ? "Not an admin" : "Couldn't sign in"}</h1>
          <p className="muted">
            {me.error.status === 403
              ? "This account isn't on the backend's ADMIN_EMAILS list."
              : me.error.message}
          </p>
          <button className="btn" onClick={signOut}>
            Sign in with another account
          </button>
        </div>
      </div>
    );
  }

  const user = me.data.user;
  return (
    <div className="app">
      <nav className="sidebar">
        <Brand />
        {NAV.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === "/"} className="nav-link">
            {label}
          </NavLink>
        ))}
        <div className="sidebar-footer">
          <strong>{user.displayName}</strong>
          {user.email}
          <div style={{ marginTop: 8 }}>
            <button className="link-button" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/users" element={<Users />} />
          <Route path="/users/:id" element={<UserDetail me={user} />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/movies/:id" element={<MovieEdit />} />
          <Route path="/collections" element={<Sagas />} />
          <Route path="/collections/new" element={<SagaEdit />} />
          <Route path="/collections/:id" element={<SagaEdit />} />
          {/* Old links: collections were called sagas here. */}
          <Route path="/sagas/*" element={<Navigate to="/collections" replace />} />
          <Route path="/clubs" element={<Clubs />} />
          <Route path="/clubs/:id" element={<ClubDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};
