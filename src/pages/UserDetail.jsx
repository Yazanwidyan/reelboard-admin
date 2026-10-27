import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api, get } from "../api";
import { Avatar, QueryState, Tile, formatDate, number, timeAgo } from "../components/shared";

// What an activity event says, in a few words.
const describe = (event) =>
  ({
    watched: `watched ${event.title ?? "a movie"}`,
    tier: `tiered ${event.title ?? "a movie"} ${event.tier}`,
    watchlist: `saved ${event.title ?? "a movie"}`,
    badge: `earned ${event.badge}`,
    set: `finished ${event.set}`,
  })[event.type] ?? event.type;

// Suspend (with a reason only admins see) or unsuspend.
const Suspension = ({ user, suspension, onChange }) => {
  const [reason, setReason] = useState("");
  const suspend = useMutation({
    mutationFn: () => api("POST", `/admin/users/${user.id}/suspend`, { reason: reason.trim() }),
    onSuccess: () => {
      setReason("");
      onChange();
    },
  });
  const unsuspend = useMutation({ mutationFn: () => api("DELETE", `/admin/users/${user.id}/suspend`), onSuccess: onChange });
  const error = suspend.error ?? unsuspend.error;

  return (
    <div className="card stack">
      <div>
        <h2>Account</h2>
        <div className="muted">
          A suspended account keeps everything, but can't sign in or use the app, and nobody else sees it — in search, on profiles, or among their friends.
          Unsuspending brings it all back.
        </div>
      </div>
      {suspension ? (
        <div className="row wrap">
          <button className="btn btn-primary" disabled={unsuspend.isPending} onClick={() => unsuspend.mutate()}>
            {unsuspend.isPending ? "Unsuspending…" : "Unsuspend"}
          </button>
        </div>
      ) : (
        <div className="row wrap">
          <input
            className="input grow"
            placeholder="Reason (only admins see it), e.g. spam lists"
            maxLength={200}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <button
            className="btn btn-danger"
            disabled={suspend.isPending}
            onClick={() => window.confirm(`Suspend ${user.displayName} (${user.handle})? They're signed out at once.`) && suspend.mutate()}
          >
            {suspend.isPending ? "Suspending…" : "Suspend"}
          </button>
        </div>
      )}
      {error && <div className="error">{error.message}</div>}
    </div>
  );
};

// ReelBoard Pro, given by hand until the app stores sell it: for a month,
// a year, or with no end — or taken away.
const Pro = ({ user, onChange }) => {
  const grant = useMutation({ mutationFn: (months) => api("POST", `/admin/users/${user.id}/pro`, { months }), onSuccess: onChange });
  const revoke = useMutation({ mutationFn: () => api("DELETE", `/admin/users/${user.id}/pro`), onSuccess: onChange });
  const busy = grant.isPending || revoke.isPending;
  const { pro } = user;
  return (
    <div className="card stack">
      <div>
        <h2>ReelBoard Pro</h2>
        <div className="muted">
          {pro?.active
            ? `Pro since ${formatDate(pro.since)}${pro.until ? `, until ${formatDate(pro.until)}` : ", with no end"}${pro.source === "admin" ? " (given here)" : ""}.`
            : "Not Pro. Pro unlocks deeper taste stats and profile style (a PRO badge and an accent colour)."}
        </div>
      </div>
      <div className="row wrap">
        <button className="btn" disabled={busy} onClick={() => grant.mutate(1)}>
          {pro?.active ? "Set to 1 month" : "Give 1 month"}
        </button>
        <button className="btn" disabled={busy} onClick={() => grant.mutate(12)}>
          {pro?.active ? "Set to 1 year" : "Give 1 year"}
        </button>
        <button className="btn" disabled={busy} onClick={() => grant.mutate(null)}>
          {pro?.active ? "Make it no end" : "Give with no end"}
        </button>
        <span className="spacer" />
        {pro?.active && (
          <button className="btn btn-danger" disabled={busy} onClick={() => window.confirm(`Take Pro away from ${user.handle}?`) && revoke.mutate()}>
            Take Pro away
          </button>
        )}
      </div>
      {(grant.error ?? revoke.error) && <div className="error">{(grant.error ?? revoke.error).message}</div>}
    </div>
  );
};

// What they've written or put up on their profile, each with a way to
// clear it.
const ProfileContent = ({ user, onChange }) => {
  const clean = useMutation({
    mutationFn: (fields) => api("POST", `/admin/users/${user.id}/clean`, fields),
    onSuccess: onChange,
  });
  const handle = user.handle.replace(/^@/, "");
  const rows = [
    {
      key: "name",
      label: "Name",
      value: user.displayName,
      action: `Reset to ${handle}`,
      hidden: user.displayName === handle,
    },
    { key: "bio", label: "Bio", value: user.bio || null, action: "Clear" },
    {
      key: "avatar",
      label: "Photo",
      // A photo picked in the app may be a file on their phone: only a web
      // one can be shown here.
      value: user.avatarUri ? (
        /^(https?:|data:image\/)/.test(user.avatarUri) ? <img src={user.avatarUri} alt="" className="content-photo" /> : "Set (on their phone)"
      ) : null,
      action: "Remove",
    },
    { key: "cover", label: "Cover still", value: user.coverMovieId ? `Movie ${user.coverMovieId}` : null, action: "Remove" },
  ];

  return (
    <div className="card">
      <h2>Profile</h2>
      {rows.map((row) => (
        <div className="content-row" key={row.key}>
          <span className="content-label">{row.label}</span>
          <span className="content-value">{row.value ?? <span className="muted">—</span>}</span>
          {row.value && !row.hidden ? (
            <button className="btn btn-small" disabled={clean.isPending} onClick={() => clean.mutate({ [row.key]: true })}>
              {row.action}
            </button>
          ) : (
            <span />
          )}
        </div>
      ))}
      {clean.isError && <div className="error">{clean.error.message}</div>}
    </div>
  );
};

// Their lists: name, films, a peek at the posters — and removing one.
const Lists = ({ lists, onChange }) => {
  const remove = useMutation({ mutationFn: (listId) => api("DELETE", `/admin/boards/${listId}`), onSuccess: onChange });
  return (
    <div className="card">
      <h2>Lists · {lists.length}</h2>
      {lists.length === 0 ? (
        <div className="muted">No lists.</div>
      ) : (
        lists.map((list) => (
          <div className="content-row" key={list.id}>
            <div className="mini-posters">
              {[0, 1, 2, 3].map((index) => (list.posters[index] ? <img key={index} src={list.posters[index]} alt="" /> : <span key={index} />))}
            </div>
            <div className="content-value">
              <strong>{list.name}</strong>
              <div className="muted">
                {list.movieCount} {list.movieCount === 1 ? "film" : "films"} · updated {timeAgo(list.updatedAt)}
              </div>
            </div>
            <button
              className="btn btn-danger btn-small"
              disabled={remove.isPending}
              onClick={() => window.confirm(`Remove the list "${list.name}"? Its films stay in their library.`) && remove.mutate(list.id)}
            >
              Remove
            </button>
          </div>
        ))
      )}
      {remove.isError && <div className="error">{remove.error.message}</div>}
    </div>
  );
};

export const UserDetail = ({ me }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["admin", "user", id], queryFn: () => get(`/admin/users/${id}`) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin"] });
  const remove = useMutation({
    mutationFn: () => api("DELETE", `/admin/users/${id}`),
    onSuccess: () => {
      refresh();
      navigate("/users");
    },
  });

  if (!detail.data) return <QueryState query={detail} />;
  const { user, counts, tiers, activity, suspension, lists } = detail.data;
  const isMe = user.id === me.id;
  // Admins can't be suspended or deleted here (nor can you).
  const protectedAccount = isMe || detail.data.isAdmin;

  const confirmDelete = () => {
    const typed = window.prompt(
      `This permanently deletes ${user.displayName}'s account and everything in it.\nType their handle (${user.handle}) to confirm.`,
    );
    if (typed?.trim().replace(/^@/, "") === user.handle.replace(/^@/, "")) remove.mutate();
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div className="row">
          <Avatar user={{ ...user, name: user.displayName }} />
          <div>
            <h1>
              {user.displayName} {suspension && <span className="badge badge-danger">Suspended</span>}
              {detail.data.isAdmin && <span className="badge badge-accent">Admin</span>}
              {user.pro?.active && <span className="badge badge-rank">Pro</span>}
            </h1>
            <div className="sub">
              {user.handle} · {user.email} · joined {formatDate(user.createdAt)}
              {user.hasPassword ? "" : " · signs in with Google / Apple"}
            </div>
          </div>
        </div>
        <Link to="/users" className="btn">
          Back
        </Link>
      </div>

      {suspension && (
        <div className="banner banner-danger">
          Suspended {timeAgo(suspension.at)}
          {suspension.reason ? ` — ${suspension.reason}` : ""}. They can't sign in, and nobody else sees them.
        </div>
      )}

      <div className="tiles">
        <Tile label="Title" value={user.title ?? "—"} sub={`${number(user.ranks)} ranks`} />
        <Tile label="Watched" value={number(counts.watched)} />
        <Tile label="Watchlist" value={number(counts.watchlist)} />
        <Tile label="Lists" value={number(counts.boards)} />
        <Tile label="Clubs" value={number(counts.clubs)} />
        <Tile label="Friends" value={number(counts.friends)} />
      </div>

      <div className="grid grid-2">
        <ProfileContent user={user} onChange={refresh} />
        <Lists lists={lists} onChange={refresh} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Tiers</h2>
          <table className="table">
            <tbody>
              {Object.entries(tiers).map(([tier, n]) => (
                <tr key={tier}>
                  <td style={{ width: 40 }}>
                    <strong>{tier}</strong>
                  </td>
                  <td className="num">{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Recent activity</h2>
          {activity.length === 0 ? (
            <div className="muted">Nothing recorded yet.</div>
          ) : (
            activity.map((event) => (
              <div key={event.id} className="row" style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                <span>{describe(event)}</span>
                <span className="spacer" />
                <span className="muted">{timeAgo(event.timestamp)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <Pro user={user} onChange={refresh} />

      {protectedAccount ? (
        <div className="card">
          <h2>Account</h2>
          <p className="muted" style={{ margin: 0 }}>
            {isMe
              ? "This is your own account — delete it from the app's Settings."
              : "This is an admin account. Take it off the backend's ADMIN_EMAILS to suspend or delete it."}
          </p>
        </div>
      ) : (
        <>
          <Suspension user={user} suspension={suspension} onChange={refresh} />
          <div className="card">
            <h2>Danger zone</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Deleting an account removes its library, tiers, lists, clubs it owns and friendships. It can't be undone — suspend it instead to keep a way back.
            </p>
            <button className="btn btn-danger" onClick={confirmDelete} disabled={remove.isPending}>
              {remove.isPending ? "Deleting…" : "Delete account"}
            </button>
            {remove.isError && <div className="error">{remove.error.message}</div>}
          </div>
        </>
      )}
    </div>
  );
};
