import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api, get } from "../api";
import { QueryState, number } from "../components/shared";

const KINDS = [
  ["all", "All"],
  ["director", "Directors"],
  ["actor", "Actors"],
];
const SHOWN = 60;

// Collections the server drafted: directors and actors with films in the
// pool and no collection yet, most wanted first (people who've seen two or
// more of the films). None of them is in the app — "Review" opens it in
// the collection editor, films picked, and creating it there approves it;
// "Dismiss" keeps it off this list (data/curation.json, draftsDismissed).
export const Drafts = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const drafts = useQuery({ queryKey: ["admin", "drafts"], queryFn: () => get("/admin/collection-drafts") });
  const [kind, setKind] = useState("all");
  const [search, setSearch] = useState("");
  const [showDismissed, setShowDismissed] = useState(false);

  const dismiss = useMutation({
    mutationFn: ({ key, dismissed }) => api("POST", "/admin/collection-drafts/dismissed", { key, dismissed }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "drafts"] }),
  });

  const review = (draft) =>
    navigate("/collections/new", {
      state: {
        draft: {
          person: draft.person,
          kind: draft.kind,
          movies: draft.movies,
        },
      },
    });

  const all = drafts.data?.drafts ?? [];
  const wanted = search.trim().toLowerCase();
  const shown = all.filter(
    (draft) => (kind === "all" || draft.kind === kind) && (!wanted || draft.person.toLowerCase().includes(wanted)),
  );
  const dismissed = drafts.data?.dismissed ?? [];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Drafts</h1>
          <div className="sub">
            {drafts.data ? `${number(all.length)} drafts · ` : ""}Not in the app until you approve one. Approved
            collections keep their films.
          </div>
        </div>
        <Link to="/collections" className="btn">
          Back to collections
        </Link>
      </div>
      <div className="toolbar">
        <input
          className="input grow"
          placeholder="Search a director or an actor"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="chips">
          {KINDS.map(([key, label]) => (
            <button key={key} className={`chip${kind === key ? " on" : ""}`} onClick={() => setKind(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {drafts.data ? (
        <>
          {shown.length === 0 && <p className="muted">No drafts match.</p>}
          <div className="saga-cards">
            {shown.slice(0, SHOWN).map((draft) => (
              <div key={draft.key} className="saga-card">
                <div className="saga-cover">
                  {draft.movies.map((movie) => (
                    <img key={movie.id} src={movie.poster} alt={movie.title} title={`${movie.title} (${movie.year ?? "?"})`} loading="lazy" />
                  ))}
                </div>
                <div className="saga-body">
                  <div className="row">
                    <span className="saga-title">{draft.person}</span>
                    <span className="spacer" />
                    <span className="badge">{draft.kind}</span>
                  </div>
                  <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                    {draft.movieIds.length < draft.total
                      ? `Best-known ${draft.movieIds.length} of ${draft.total} films`
                      : `${draft.total} films`}{" "}
                    · {draft.people === 1 ? "1 person has" : `${number(draft.people)} people have`} seen 2+
                  </div>
                  <div className="row" style={{ marginTop: 10 }}>
                    <button className="btn btn-primary btn-small" onClick={() => review(draft)}>
                      Review
                    </button>
                    <button
                      className="btn btn-small"
                      disabled={dismiss.isPending}
                      onClick={() => dismiss.mutate({ key: draft.key, dismissed: true })}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {shown.length > SHOWN && (
            <p className="muted">
              Showing {SHOWN} of {number(shown.length)} — search for anyone else.
            </p>
          )}
          {dismissed.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <button className="link-button" onClick={() => setShowDismissed((value) => !value)}>
                {showDismissed ? "Hide" : "Show"} {dismissed.length} dismissed
              </button>
              {showDismissed && (
                <div className="chips" style={{ marginTop: 10 }}>
                  {dismissed.map((key) => (
                    <button
                      key={key}
                      className="chip"
                      title="Bring it back"
                      disabled={dismiss.isPending}
                      onClick={() => dismiss.mutate({ key, dismissed: false })}
                    >
                      {key.replace(/^\w+:/, "")} ↺
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <QueryState query={drafts} />
      )}
    </div>
  );
};
