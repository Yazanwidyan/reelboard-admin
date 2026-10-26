import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, get } from "../api";
import { Poster, QueryState, Tile, number } from "../components/shared";

const MAX_THEMES = 3;

// One movie: hand-tune its vibe (six Taste DNA scores, up to three themes),
// set its franchise, put it in or take it out of the pool.
export const MovieEdit = () => {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const meta = useQuery({ queryKey: ["admin", "meta"], queryFn: () => get("/admin/meta"), staleTime: Infinity });
  const detail = useQuery({ queryKey: ["admin", "movie", id], queryFn: () => get(`/admin/movies/${id}`) });

  const [dims, setDims] = useState(null);
  const [themes, setThemes] = useState([]);
  const [franchise, setFranchise] = useState("");
  // Start from the movie as saved (again after each save).
  useEffect(() => {
    const movie = detail.data?.movie;
    if (!movie) return;
    setDims(movie.vibe?.dims ?? [3, 3, 3, 3, 3, 3]);
    setThemes(movie.vibe?.themes ?? []);
    setFranchise(movie.franchise ?? "");
  }, [detail.data]);

  const save = useMutation({
    mutationFn: (body) => api("PATCH", `/admin/movies/${id}`, body),
    onSuccess: (data) => {
      queryClient.setQueryData(["admin", "movie", id], (old) => ({ ...old, ...data }));
      queryClient.invalidateQueries({ queryKey: ["admin", "movies"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });

  if (!detail.data || !meta.data || !dims) return <QueryState query={detail.data ? meta : detail} />;
  const { movie, stats } = detail.data;
  const vibeChanged =
    dims.join() !== (movie.vibe?.dims ?? []).join() || themes.join() !== (movie.vibe?.themes ?? []).join();
  const franchiseChanged = franchise.trim() !== (movie.franchise ?? "");

  const toggleTheme = (key) =>
    setThemes((current) =>
      current.includes(key) ? current.filter((theme) => theme !== key) : [...current, key].slice(0, MAX_THEMES),
    );

  const saveChanges = () =>
    save.mutate({
      ...(vibeChanged ? { vibe: { dims, themes } } : {}),
      ...(franchiseChanged ? { franchise: franchise.trim() || null } : {}),
    });

  return (
    <div className="stack">
      <div className="hero">
        {movie.backdrop && <img className="hero-backdrop" src={movie.backdrop} alt="" />}
        <div className="hero-content">
          <Poster src={movie.poster} large />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row wrap" style={{ gap: 6 }}>
              <span className={`badge ${movie.inPool ? "badge-green" : ""}`}>{movie.inPool ? `In the pool · #${movie.rank}` : "Not in the pool"}</span>
              <span className={`badge ${movie.vibeSource === "hand" ? "badge-accent" : ""}`}>
                {movie.vibeSource === "hand" ? "Hand-tuned vibe" : "Estimated vibe"}
              </span>
            </div>
            <h1 style={{ marginTop: 8 }}>
              {movie.title} <span className="muted">{movie.year ?? ""}</span>
            </h1>
            <div className="sub">
              {[movie.director, movie.genres?.join(" · "), movie.rating ? `TMDB ${movie.rating}` : null, `TMDB id ${movie.id}`]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          <Link to="/movies" className="btn">
            Back
          </Link>
        </div>
      </div>

      <div className="tiles">
        <Tile label="Watched by" value={number(stats.watched)} />
        <Tile label="On watchlists" value={number(stats.watchlist)} />
        <Tile label="Tiers" value={Object.entries(stats.tiers).filter(([, n]) => n).map(([tier, n]) => `${tier} ${n}`).join(" · ") || "—"} />
        <Tile label="In collections" value={stats.sagas.length} sub={stats.sagas.map((saga) => saga.title).join(", ") || " "} />
      </div>

      <div className="card stack">
        <div>
          <h2>Taste DNA</h2>
          <div className="muted">Each score is 1–5 between its two ends. Saving makes the vibe hand-tuned — and hand-tuned vibes teach the estimate for every other movie at the next build-pool.</div>
        </div>
        {meta.data.dimensions.map((dimension, index) => (
          <div className="dim" key={dimension.key}>
            <span className="dim-low">{dimension.low}</span>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={dims[index]}
              aria-label={`${dimension.low} to ${dimension.high}`}
              onChange={(event) =>
                setDims((current) => current.map((value, i) => (i === index ? Number(event.target.value) : value)))
              }
            />
            <span className="dim-high">{dimension.high}</span>
            <span className="dim-value">{dims[index]}</span>
          </div>
        ))}
        <div>
          <div className="muted" style={{ marginBottom: 8 }}>
            Themes — up to {MAX_THEMES} ({themes.length} chosen)
          </div>
          <div className="chips">
            {Object.entries(meta.data.themes).map(([key, label]) => {
              const on = themes.includes(key);
              return (
                <button
                  key={key}
                  className={`chip ${on ? "on" : ""}`}
                  onClick={() => toggleTheme(key)}
                  disabled={!on && themes.length >= MAX_THEMES}
                  title={label}
                >
                  {key}
                </button>
              );
            })}
          </div>
        </div>
        <label className="field" style={{ maxWidth: 360 }}>
          <span>Franchise (groups it with its series — leave empty for none)</span>
          <input className="input" value={franchise} onChange={(event) => setFranchise(event.target.value)} placeholder="e.g. The Dark Knight Trilogy" />
        </label>
        <div className="row">
          <button className="btn btn-primary" onClick={saveChanges} disabled={!(vibeChanged || franchiseChanged) || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
          {save.isSuccess && !vibeChanged && !franchiseChanged && <span className="ok">Saved.</span>}
          {save.isError && <span className="error">{save.error.message}</span>}
        </div>
      </div>

      <div className="card">
        <h2>The pool</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {movie.inPool
            ? "In the pool, Swipe, Spin, recommendations and collections can pick it. Taking it out keeps it out at the next build-pool too."
            : "Outside the pool it can still be found, watched and saved — but Decide never suggests it."}
        </p>
        <button
          className={movie.inPool ? "btn btn-danger" : "btn btn-primary"}
          onClick={() => save.mutate({ inPool: !movie.inPool })}
          disabled={save.isPending}
        >
          {movie.inPool ? "Take out of the pool" : "Add to the pool"}
        </button>
      </div>
    </div>
  );
};
