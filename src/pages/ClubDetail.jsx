import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api, get } from "../api";
import { Avatar, Poster, QueryState, formatDate, timeAgo } from "../components/shared";

// The app's limits (routes/clubs.js on the backend).
const NAME_MAX = 40;
const DESCRIPTION_MAX = 200;

// One club: rename it or change its description, see who's in it, and take
// films off its shared board.
export const ClubDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["admin", "club", id], queryFn: () => get(`/admin/clubs/${id}`) });
  const [form, setForm] = useState({ name: "", description: "" });
  useEffect(() => {
    if (detail.data) setForm({ name: detail.data.club.name, description: detail.data.club.description });
  }, [detail.data]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

  const save = useMutation({
    mutationFn: () => api("PATCH", `/admin/clubs/${id}`, { name: form.name.trim(), description: form.description.trim() }),
    onSuccess: refresh,
  });
  const removeFilm = useMutation({ mutationFn: (movieId) => api("DELETE", `/admin/clubs/${id}/movies/${movieId}`), onSuccess: refresh });
  const removeClub = useMutation({
    mutationFn: () => api("DELETE", `/admin/clubs/${id}`),
    onSuccess: () => {
      refresh();
      navigate("/clubs");
    },
  });

  if (!detail.data) return <QueryState query={detail} />;
  const { club, members, movies } = detail.data;
  const changed = form.name.trim() !== club.name || form.description.trim() !== club.description;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{club.name}</h1>
          <div className="sub">
            {members.length} {members.length === 1 ? "member" : "members"} · {movies.length} films · created {formatDate(club.createdAt)}
          </div>
        </div>
        <Link to="/clubs" className="btn">
          Back
        </Link>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Name and description</h2>
        <label className="field">
          <span>Name</span>
          <input className="input" maxLength={NAME_MAX} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>
        <label className="field">
          <span>
            Description · {form.description.length}/{DESCRIPTION_MAX}
          </span>
          <textarea
            className="input"
            rows={3}
            maxLength={DESCRIPTION_MAX}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </label>
        <div className="row wrap">
          <button className="btn btn-primary" disabled={!changed || !form.name.trim() || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
          {club.description && (
            <button className="btn" disabled={save.isPending} onClick={() => setForm({ ...form, description: "" })}>
              Clear description
            </button>
          )}
          {save.isSuccess && !changed && <span className="ok">Saved — live in the app.</span>}
          {save.isError && <span className="error">{save.error.message}</span>}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Shared board · {movies.length}</h2>
          {movies.length === 0 ? (
            <div className="muted">No films on the board.</div>
          ) : (
            movies.map((movie) => (
              <div className="film-row" key={movie.id}>
                <Poster src={movie.poster} />
                <div>
                  {movie.title} <span className="muted">{movie.year ?? ""}</span>
                  {movie.id === club.nowWatchingId && <span className="badge badge-accent" style={{ marginLeft: 6 }}>Now watching</span>}
                  <div className="muted" style={{ fontSize: 12 }}>
                    {movie.addedBy ? `Added by ${movie.addedBy.handle}` : "Added by a deleted account"} · {timeAgo(movie.addedAt)}
                  </div>
                </div>
                <button
                  className="btn btn-small"
                  disabled={removeFilm.isPending}
                  onClick={() => window.confirm(`Take "${movie.title}" off the board?`) && removeFilm.mutate(movie.id)}
                >
                  Remove
                </button>
              </div>
            ))
          )}
          {removeFilm.isError && <div className="error">{removeFilm.error.message}</div>}
        </div>
        <div className="card">
          <h2>Members · {members.length}</h2>
          {members.map((member) => (
            <Link to={`/users/${member.id}`} className="content-row content-link" key={member.id}>
              <Avatar user={member} />
              <span className="content-value">
                <strong>{member.name}</strong> <span className="muted">{member.handle}</span>
                {member.suspended && <span className="badge badge-danger" style={{ marginLeft: 6 }}>Suspended</span>}
              </span>
              <span className="muted">{member.role === "owner" ? "Owner" : `Joined ${timeAgo(member.joinedAt)}`}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Danger zone</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Removing the club takes it away from all {members.length} members. It can't be undone.
        </p>
        <button
          className="btn btn-danger"
          disabled={removeClub.isPending}
          onClick={() => window.confirm(`Remove "${club.name}" for all ${members.length} members?`) && removeClub.mutate()}
        >
          Remove club
        </button>
        {removeClub.isError && <div className="error">{removeClub.error.message}</div>}
      </div>
    </div>
  );
};
