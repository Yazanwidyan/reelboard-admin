import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { get, query } from "../api";
import { Pager, Poster, QueryState, number, useDebounced } from "../components/shared";

const SCOPES = [
  ["pool", "Pool"],
  ["other", "Other stored"],
  ["all", "All stored"],
  ["tmdb", "Search TMDB"],
];

// The pool (and every other movie the server has), with each one's vibe:
// hand-tuned or estimated. "Search TMDB" finds any movie at all — open one
// to put it in the pool.
export const Movies = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("pool");
  const [vibe, setVibe] = useState("any");
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());
  const isTmdb = scope === "tmdb";

  const stored = useQuery({
    queryKey: ["admin", "movies", q, scope, vibe, page],
    queryFn: () => get(`/admin/movies${query({ q, scope, vibe, page })}`),
    enabled: !isTmdb,
    placeholderData: keepPreviousData,
  });
  const tmdb = useQuery({
    queryKey: ["tmdb-search", q, page],
    queryFn: () => get(`/movies/search${query({ q, page })}`),
    enabled: isTmdb && q.length > 0,
    placeholderData: keepPreviousData,
  });

  const reset = (update) => (value) => {
    update(value);
    setPage(1);
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Movies & vibes</h1>
          <div className="sub">
            Hand-tune a movie's Taste DNA, set its franchise, or put it in or out of the pool. Changes are live and saved to
            data/curation.json.
          </div>
        </div>
      </div>
      <div className="toolbar">
        <div className="segmented">
          {SCOPES.map(([key, label]) => (
            <button key={key} className={scope === key ? "on" : ""} onClick={() => reset(setScope)(key)}>
              {label}
            </button>
          ))}
        </div>
        <input
          className="input grow"
          placeholder={isTmdb ? "Search every movie on TMDB" : "Title, director, franchise or TMDB id"}
          value={search}
          onChange={(event) => reset(setSearch)(event.target.value)}
        />
        {!isTmdb && (
          <select className="select" value={vibe} onChange={(event) => reset(setVibe)(event.target.value)}>
            <option value="any">Any vibe</option>
            <option value="hand">Hand-tuned</option>
            <option value="estimated">Estimated</option>
          </select>
        )}
      </div>

      {isTmdb ? (
        q.length === 0 ? (
          <div className="empty">Type to search TMDB.</div>
        ) : tmdb.data ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th />
                    <th>Title</th>
                    <th className="num">Rating</th>
                    <th className="num">Votes</th>
                    <th>TMDB id</th>
                  </tr>
                </thead>
                <tbody>
                  {tmdb.data.results.map((movie) => (
                    <tr key={movie.id} className="clickable" onClick={() => navigate(`/movies/${movie.id}`)}>
                      <td style={{ width: 50 }}>
                        <Poster src={movie.poster} />
                      </td>
                      <td>
                        <strong>{movie.title}</strong> <span className="muted">{movie.year ?? ""}</span>
                      </td>
                      <td className="num">{movie.rating || "—"}</td>
                      <td className="num">{number(movie.votes)}</td>
                      <td className="muted">{movie.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tmdb.data.results.length === 0 && <div className="empty">Nothing on TMDB by that name.</div>}
            </div>
            <Pager page={page} totalPages={tmdb.data.totalPages} total={tmdb.data.totalResults} onChange={setPage} />
          </>
        ) : (
          <QueryState query={tmdb} />
        )
      ) : stored.data ? (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th />
                  <th>Title</th>
                  <th className="num">Rating</th>
                  <th className="num">Votes</th>
                  <th className="num">Watched</th>
                  <th>Vibe</th>
                  <th>Franchise</th>
                  <th className="num">Pool rank</th>
                </tr>
              </thead>
              <tbody>
                {stored.data.movies.map((movie) => (
                  <tr key={movie.id} className="clickable" onClick={() => navigate(`/movies/${movie.id}`)}>
                    <td style={{ width: 50 }}>
                      <Poster src={movie.poster} />
                    </td>
                    <td>
                      <strong>{movie.title}</strong> <span className="muted">{movie.year ?? ""}</span>
                    </td>
                    <td className="num">{movie.rating || "—"}</td>
                    <td className="num">{number(movie.votes)}</td>
                    <td className="num">{number(movie.watchedCount)}</td>
                    <td>
                      <span className={`badge ${movie.vibeSource === "hand" ? "badge-accent" : ""}`}>
                        {movie.vibeSource === "hand" ? "Hand-tuned" : "Estimated"}
                      </span>
                    </td>
                    <td className="muted">{movie.franchise ?? ""}</td>
                    <td className="num">{movie.inPool ? movie.rank : <span className="muted">not in pool</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stored.data.movies.length === 0 && <div className="empty">No movies match.</div>}
          </div>
          <Pager page={page} totalPages={stored.data.totalPages} total={stored.data.total} onChange={setPage} />
        </>
      ) : (
        <QueryState query={stored} />
      )}
    </div>
  );
};
