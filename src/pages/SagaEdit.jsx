import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api, get, query } from "../api";
import { Poster, QueryState, useDebounced } from "../components/shared";

const KINDS = ["franchise", "studio", "theme", "director", "actor"];
// Where a collection's films come from (its `from` in data/curation.json):
// picked here, or a rule the server resolves on TMDB — the same way
// `npm run build-pool` does, so a rebuild keeps them up to date.
const SOURCES = [
  { key: "picked", label: "Picked by hand" },
  { key: "tmdbCollections", label: "TMDB collection", kind: "franchise" },
  { key: "director", label: "Director", kind: "director" },
  { key: "actor", label: "Actor", kind: "actor" },
  { key: "company", label: "Studio", kind: "studio" },
];
// What build-pool assumes when a rule doesn't say (lib/sagaSources).
const DEFAULT_MIN_VOTES = { director: 500, actor: 1500, company: 300 };
const MIN_FILMS = 3;
const MAX_RANKS = 5;
const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
const imageOf = (art) => art?.backdrop ?? art?.photo ?? null;

// A rank as the editor holds it: films, or a percentage of them.
const toEditable = (rank) =>
  rank.share != null
    ? { title: rank.title, mode: "share", at: 1, share: Math.round(rank.share * 100) }
    : { title: rank.title, mode: "at", at: rank.at === "all" ? 1 : rank.at, share: 60 };
// How many films each rank needs, as the server will count them.
const countRanks = (ranks, total) =>
  ranks.map((rank, index) =>
    index === ranks.length - 1
      ? total
      : rank.mode === "share"
        ? Math.max(1, Math.ceil((Number(rank.share) / 100) * total))
        : Number(rank.at) || 0,
  );

// The rule being built, as the API takes it — or null while it's missing
// its collection, person or studio.
const ruleBody = (source, rule) => {
  const number = (value) => (value === "" || value == null ? undefined : Number(value));
  if (source === "tmdbCollections") {
    return rule.collections.length > 0 ? { tmdbCollections: rule.collections.map((item) => item.id) } : null;
  }
  if (source === "company") return rule.company ? { company: rule.company.id, minVotes: number(rule.minVotes) } : null;
  if (source === "director" || source === "actor") {
    return rule.person ? { [source]: rule.person.name, minVotes: number(rule.minVotes), top: number(rule.top) } : null;
  }
  return null;
};
const emptyRule = { collections: [], person: null, company: null, minVotes: "", top: "" };
// A rule from the curation, back into the editor. (A list of titles shows
// as its films, picked by hand.)
const fromCurated = (from) => {
  if (!from || from.ids || from.movies) return { source: "picked", rule: emptyRule };
  if (from.tmdbCollections) {
    return { source: "tmdbCollections", rule: { ...emptyRule, collections: from.tmdbCollections.map((id) => ({ id, name: `#${id}` })) } };
  }
  const limits = { minVotes: from.minVotes ?? "", top: from.top ?? "" };
  if (from.company) return { source: "company", rule: { ...emptyRule, ...limits, company: { id: from.company, name: `Studio #${from.company}` } } };
  return { source: from.director ? "director" : "actor", rule: { ...emptyRule, ...limits, person: { name: from.director ?? from.actor } } };
};

// Search TMDB for a collection, a person or a studio, and pick one.
const TmdbPicker = ({ type, placeholder, onPick, picked = [] }) => {
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const results = useQuery({
    queryKey: ["tmdb-search", type, q],
    queryFn: async () => (await get(`/admin/tmdb/search${query({ type, q })}`)).results,
    enabled: q.length > 0,
  });
  return (
    <div>
      <input className="input" style={{ width: "100%" }} placeholder={placeholder} value={search} onChange={(event) => setSearch(event.target.value)} />
      {q && (
        <div className="results pick-results">
          {results.isPending ? (
            <div className="muted pick-note">Searching TMDB…</div>
          ) : results.isError ? (
            <div className="error pick-note">{results.error.message}</div>
          ) : results.data.length === 0 ? (
            <div className="muted pick-note">Nothing on TMDB called that.</div>
          ) : (
            results.data.map((item) => {
              const isPicked = picked.includes(item.id);
              return (
                <button
                  key={item.id}
                  className="pick-row"
                  disabled={isPicked}
                  onClick={() => {
                    onPick(item);
                    setSearch("");
                  }}
                >
                  {item.image ? (
                    <img src={item.image} alt="" className={type === "company" ? "pick-logo" : "pick-image"} />
                  ) : (
                    <span className="pick-image" />
                  )}
                  <span>
                    <strong>{item.name}</strong>
                    <span className="muted">
                      {item.department ? ` · ${item.department}` : ""}
                      {item.knownFor?.length ? ` · ${item.knownFor.join(", ")}` : ""}
                      {item.country ? ` · ${item.country}` : ""}
                    </span>
                  </span>
                  <span className="muted">{isPicked ? "Added" : "Use"}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

// Find films to add: the stored ones (the pool first), or any on TMDB.
const FilmFinder = ({ onAdd, have }) => {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("stored");
  const q = useDebounced(search.trim());
  const results = useQuery({
    queryKey: ["film-finder", source, q],
    queryFn: async () =>
      source === "stored"
        ? (await get(`/admin/movies${query({ q, scope: "all", limit: 20 })}`)).movies
        : (await get(`/movies/search${query({ q })}`)).results,
    enabled: q.length > 0,
  });
  return (
    <div className="stack">
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <div className="segmented">
          <button className={source === "stored" ? "on" : ""} onClick={() => setSource("stored")}>
            Pool & stored
          </button>
          <button className={source === "tmdb" ? "on" : ""} onClick={() => setSource("tmdb")}>
            TMDB
          </button>
        </div>
        <input className="input grow" placeholder="Find a film to add" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {q && (
        <div className="results">
          {results.isPending ? (
            <div className="muted">Searching…</div>
          ) : (
            (results.data ?? []).map((movie) => (
              <div className="film-row" key={movie.id}>
                <Poster src={movie.poster} />
                <div>
                  {movie.title} <span className="muted">{movie.year ?? ""}</span>
                  {movie.inPool === false && <span className="muted"> · joins the pool</span>}
                </div>
                <button className="btn btn-small" disabled={have.has(movie.id)} onClick={() => onAdd(movie)}>
                  {have.has(movie.id) ? "Added" : "Add"}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// How it looks in the app: the collection's page (its picture, name and
// ladder) and its card on the Library shelf (four posters).
const AppPreview = ({ form, art, films, ranks, counts }) => (
  <div className="preview-col">
    <div className="preview-label">In the app</div>
    <div className="phone">
      <div className={`phone-hero ${art?.photo ? "phone-hero-photo" : ""}`}>
        {imageOf(art) && <img src={imageOf(art)} alt="" />}
        <div className="phone-hero-text">
          <div className="phone-kind">{form.kind}</div>
          <div className="phone-title">{form.title || "Untitled"}</div>
          {form.subtitle && <div className="phone-sub">{form.subtitle}</div>}
        </div>
      </div>
      <div className="phone-body">
        <div className="phone-meta">0 of {plural(films.length, "film")} watched</div>
        <div className="phone-bar" />
        <div className="phone-section">Ranks</div>
        {ranks.map((rank, index) => {
          const isLast = index === ranks.length - 1;
          return (
            <div className="phone-rank" key={index}>
              <span className={`phone-rank-dot ${isLast ? "top" : ""}`} />
              <span className="phone-rank-title">{rank.title || "Unnamed rank"}</span>
              <span className="muted">{isLast ? "Every film" : plural(counts[index] || 0, "film")}</span>
            </div>
          );
        })}
      </div>
    </div>
    <div className="preview-label" style={{ marginTop: 16 }}>
      On the Library shelf
    </div>
    <div className="shelf-card">
      <div className="shelf-collage">
        {[0, 1, 2, 3].map((index) => {
          const movie = films.length > 0 ? films[index % films.length] : null;
          return movie?.poster ? <img key={index} src={movie.poster} alt="" /> : <span key={index} />;
        })}
      </div>
      <div className="shelf-title">{form.title || "Untitled"}</div>
      <div className="muted shelf-meta">0 of {films.length} watched</div>
    </div>
  </div>
);

// A collection: its name, where its films come from, its ranks and its
// picture — new (/collections/new) or existing — with how it looks in the
// app alongside.
export const SagaEdit = () => {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["admin", "saga", id], queryFn: () => get(`/admin/sagas/${id}`), enabled: !isNew });

  const [form, setForm] = useState({ slug: "", title: "", subtitle: "", kind: "franchise" });
  const [source, setSource] = useState("picked");
  const [rule, setRule] = useState(emptyRule);
  const [ranks, setRanks] = useState([toEditable({ title: "", at: 1 }), toEditable({ title: "", at: "all" })]);
  const [films, setFilms] = useState([]);
  // The picked picture (null: automatic), and what it was when loaded.
  const [art, setArt] = useState(null);
  const [loadedArt, setLoadedArt] = useState(null);
  useEffect(() => {
    if (!detail.data) return;
    const { saga, movies, from, curated } = detail.data;
    setForm({ slug: saga.id.replace(/^saga-/, ""), title: saga.title, subtitle: saga.subtitle ?? "", kind: saga.kind });
    const loaded = fromCurated(from);
    setSource(loaded.source);
    setRule(loaded.rule);
    setRanks((curated?.ranks ?? saga.ranks).map(toEditable));
    setFilms(movies);
    setArt(curated?.art ?? null);
    setLoadedArt(curated?.art ?? null);
  }, [detail.data]);

  // A rule's films, previewed from TMDB as it's built.
  const isRule = source !== "picked";
  const body = ruleBody(source, rule);
  const ruleKey = useDebounced(body ? JSON.stringify(body) : "", 400);
  const preview = useQuery({
    queryKey: ["saga-preview", ruleKey],
    queryFn: () => api("POST", "/admin/sagas/preview", { from: JSON.parse(ruleKey) }),
    enabled: isRule && Boolean(ruleKey),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const loading = isRule && Boolean(body) && (preview.isFetching || ruleKey !== JSON.stringify(body));
  const shownFilms = isRule ? (body ? (preview.data?.movies ?? []) : []) : films;
  const total = shownFilms.length;
  const counts = countRanks(ranks, total);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        kind: form.kind,
        ...(isRule ? { from: body } : { movieIds: films.map((movie) => movie.id) }),
        ranks: ranks.map((rank, index) =>
          index === ranks.length - 1
            ? { title: rank.title.trim() }
            : rank.mode === "share"
              ? { title: rank.title.trim(), share: Number(rank.share) / 100 }
              : { title: rank.title.trim(), at: Number(rank.at) },
        ),
        ...(isNew || imageOf(art) !== imageOf(loadedArt) ? { art } : {}),
      };
      return isNew ? api("POST", "/admin/sagas", { id: form.slug, ...payload }) : api("PATCH", `/admin/sagas/${id}`, payload);
    },
    onSuccess: (data) => {
      setLoadedArt(art);
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      if (isNew) navigate(`/collections/${data.saga.id}`, { replace: true });
    },
  });
  const remove = useMutation({
    mutationFn: () => api("DELETE", `/admin/sagas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      navigate("/collections");
    },
  });

  if (!isNew && !detail.data) return <QueryState query={detail} />;
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const setRuleField = (key, value) => setRule((current) => ({ ...current, [key]: value }));
  const have = new Set(films.map((movie) => movie.id));
  const move = (index, step) =>
    setFilms((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(index + step, 0, item);
      return next;
    });
  const setRank = (index, key, value) =>
    setRanks((current) => current.map((rank, i) => (i === index ? { ...rank, [key]: value } : rank)));
  const chooseSource = (key) => {
    setSource(key);
    const kind = SOURCES.find((item) => item.key === key)?.kind;
    if (kind && isNew) setForm((current) => ({ ...current, kind }));
  };
  // Stop following the rule: its films become a list to edit by hand.
  const pickByHand = () => {
    setFilms(shownFilms);
    setSource("picked");
  };

  // The picture choices: the rule's own (a franchise's backdrop, a
  // person's photo), the one picked, then the films' backdrops.
  const artChoices = [
    ...(isRule && preview.data?.art ? [preview.data.art] : []),
    ...(art ? [art] : []),
    ...shownFilms.filter((movie) => movie.backdrop).map((movie) => ({ backdrop: movie.backdrop })),
  ]
    .filter((choice, index, list) => list.findIndex((other) => imageOf(other) === imageOf(choice)) === index)
    .slice(0, 12);
  // What "automatic" shows: the rule's picture, else what the server has,
  // else the first film's backdrop.
  const firstBackdrop = shownFilms.find((movie) => movie.backdrop)?.backdrop;
  const autoArt =
    (isRule && preview.data?.art) ||
    (!isNew && !loadedArt && detail.data.saga.art) ||
    (firstBackdrop ? { backdrop: firstBackdrop } : null);
  const shownArt = art ?? autoArt;

  const problems = [
    !form.title.trim() && "a title",
    isNew && !/^[a-z0-9-]{2,60}$/.test(form.slug) && "an id (lowercase letters, numbers, dashes)",
    isRule && !body && (source === "tmdbCollections" ? "a TMDB collection" : source === "company" ? "a studio" : "a person"),
    loading && "its films to load",
    !loading && total < MIN_FILMS && `at least ${MIN_FILMS} films`,
    ranks.some((rank) => !rank.title.trim()) && "a name for every rank",
    counts.some((count, index) => index > 0 && count <= counts[index - 1]) && "each rank to need more films than the one before",
  ].filter(Boolean);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{isNew ? "New collection" : form.title || "Collection"}</h1>
          {!isNew && (
            <div className="sub">
              {detail.data.stats.started} started · {detail.data.stats.finished} finished
            </div>
          )}
        </div>
        <Link to="/collections" className="btn">
          Back
        </Link>
      </div>

      <div className="editor-layout">
        <div className="stack">
          <div className="card stack">
            <div className="grid grid-2">
              <label className="field">
                <span>Title — the achievement's name ("Potterhead")</span>
                <input
                  className="input"
                  value={form.title}
                  onChange={(event) => {
                    set("title")(event);
                    if (isNew) setForm((current) => ({ ...current, slug: slugify(event.target.value) }));
                  }}
                />
              </label>
              <label className="field">
                <span>Subtitle — what it is ("Every Harry Potter film")</span>
                <input className="input" value={form.subtitle} onChange={set("subtitle")} />
              </label>
              <label className="field">
                <span>Kind — which Library section it's in</span>
                <select className="select" value={form.kind} onChange={set("kind")}>
                  {KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Id {isNew ? "(can't change later)" : ""}</span>
                <input className="input" value={form.slug} onChange={set("slug")} disabled={!isNew} />
              </label>
            </div>
          </div>

          {/* Where the films come from. */}
          <div className="card stack">
            <div>
              <h2>Films · {loading ? "…" : total}</h2>
              <div className="muted">
                {isRule
                  ? "Follows a rule on TMDB, oldest first. A rebuild (npm run build-pool) adds new releases."
                  : "In watching order. Films not in the pool join it."}
              </div>
            </div>
            <div className="segmented wrap">
              {SOURCES.map((item) => (
                <button key={item.key} className={source === item.key ? "on" : ""} onClick={() => chooseSource(item.key)}>
                  {item.label}
                </button>
              ))}
            </div>

            {source === "tmdbCollections" && (
              <div className="stack">
                {rule.collections.length > 0 && (
                  <div className="chips">
                    {rule.collections.map((item, index) => (
                      <span className="tag-chip" key={item.id}>
                        {/* Loaded from the curation, they're ids: the preview names them. */}
                        {item.name.startsWith("#") ? (preview.data?.source.split(" + ")[index] ?? item.name) : item.name}
                        <button
                          aria-label={`Remove ${item.name}`}
                          onClick={() => setRuleField("collections", rule.collections.filter((other) => other.id !== item.id))}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <TmdbPicker
                  type="collection"
                  placeholder={rule.collections.length ? "Add another collection (e.g. Creed with Rocky)" : "Search TMDB collections, e.g. Harry Potter"}
                  picked={rule.collections.map((item) => item.id)}
                  onPick={(item) => setRuleField("collections", [...rule.collections, { id: item.id, name: item.name }])}
                />
              </div>
            )}

            {(source === "director" || source === "actor" || source === "company") && (
              <div className="stack">
                {(source === "company" ? rule.company : rule.person) ? (
                  <div className="row">
                    <span className="tag-chip">
                      {source === "company" && rule.company.name.startsWith("Studio #")
                        ? (preview.data?.source ?? rule.company.name)
                        : (source === "company" ? rule.company : rule.person).name}
                      <button aria-label="Choose another" onClick={() => setRuleField(source === "company" ? "company" : "person", null)}>
                        ×
                      </button>
                    </span>
                  </div>
                ) : (
                  <TmdbPicker
                    type={source === "company" ? "company" : "person"}
                    placeholder={
                      source === "company"
                        ? "Search studios, e.g. A24"
                        : source === "director"
                          ? "Search directors, e.g. Denis Villeneuve"
                          : "Search actors, e.g. Tom Hanks"
                    }
                    onPick={(item) =>
                      source === "company"
                        ? setRuleField("company", { id: item.id, name: item.name })
                        : setRuleField("person", { name: item.name })
                    }
                  />
                )}
                <div className="row wrap" style={{ alignItems: "flex-end" }}>
                  <label className="field">
                    <span>Minimum TMDB votes</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      style={{ width: 150 }}
                      placeholder={String(DEFAULT_MIN_VOTES[source])}
                      value={rule.minVotes}
                      onChange={(event) => setRuleField("minVotes", event.target.value)}
                    />
                  </label>
                  {source !== "company" && (
                    <label className="field">
                      <span>Keep only the best-known</span>
                      <input
                        className="input"
                        type="number"
                        min={MIN_FILMS}
                        max={100}
                        style={{ width: 150 }}
                        placeholder="All"
                        value={rule.top}
                        onChange={(event) => setRuleField("top", event.target.value)}
                      />
                    </label>
                  )}
                  <span className="muted" style={{ paddingBottom: 9 }}>
                    {source === "actor" ? "Lead roles only (top three billed)." : "Fewer votes lets in lesser-known films."}
                  </span>
                </div>
              </div>
            )}

            {isRule && body && (
              <div className="stack">
                {preview.isError ? (
                  <div className="error">{preview.error.message}</div>
                ) : !preview.data ? (
                  <div className="muted">Finding the films on TMDB…</div>
                ) : (
                  <div className="row wrap">
                    <span className="muted">
                      {preview.data.source} → {plural(total, "film")}
                      {loading ? " · updating…" : ""}
                    </span>
                    <span className="spacer" />
                    {total > 0 && (
                      <button className="btn btn-small" onClick={pickByHand}>
                        Edit these by hand instead
                      </button>
                    )}
                  </div>
                )}
                {shownFilms.length > 0 && (
                  <div className="poster-strip">
                    {shownFilms.map((movie) => (
                      <div key={movie.id} className="strip-film" title={`${movie.title} (${movie.year ?? "?"})`}>
                        <Poster src={movie.poster} />
                        <span>{movie.year ?? ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {source === "picked" && (
              <>
                {detail.data?.from?.movies && (
                  <div className="muted">Built from a list of titles. Saving different films keeps them as picked here.</div>
                )}
                <div>
                  {films.map((movie, index) => (
                    <div className="film-row" key={movie.id}>
                      <Poster src={movie.poster} />
                      <div>
                        <span className="muted">{index + 1}.</span> {movie.title} <span className="muted">{movie.year ?? ""}</span>
                      </div>
                      <div className="row" style={{ gap: 4 }}>
                        <button className="btn btn-small" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up">
                          ↑
                        </button>
                        <button className="btn btn-small" disabled={index === films.length - 1} onClick={() => move(index, 1)} aria-label="Move down">
                          ↓
                        </button>
                        <button className="btn btn-small" onClick={() => setFilms((current) => current.filter((item) => item.id !== movie.id))}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <FilmFinder have={have} onAdd={(movie) => setFilms((current) => [...current, movie])} />
              </>
            )}
          </div>

          {/* The ladder. */}
          <div className="card stack">
            <div>
              <h2>Ranks</h2>
              <div className="muted">
                The collection's own ladder, climbed as people watch. Set a rank by films, or by a share of them so it keeps up as the collection grows. The last
                one always needs every film.
              </div>
            </div>
            {ranks.map((rank, index) => {
              const isLast = index === ranks.length - 1;
              const tooFew = index > 0 && counts[index] <= counts[index - 1];
              return (
                <div className="rank-row" key={index}>
                  <input
                    className="input grow"
                    placeholder={isLast ? "Final rank, e.g. Hogwarts Graduate" : "Rank, e.g. Prefect"}
                    value={rank.title}
                    onChange={(event) => setRank(index, "title", event.target.value)}
                  />
                  {isLast ? (
                    <span className={`rank-need ${tooFew ? "error" : ""}`}>Every film · {total}</span>
                  ) : (
                    <>
                      <div className="segmented">
                        <button className={rank.mode === "at" ? "on" : ""} onClick={() => setRank(index, "mode", "at")}>
                          Films
                        </button>
                        <button className={rank.mode === "share" ? "on" : ""} onClick={() => setRank(index, "mode", "share")}>
                          %
                        </button>
                      </div>
                      <input
                        className={`input ${tooFew ? "input-bad" : ""}`}
                        type="number"
                        min={1}
                        max={rank.mode === "share" ? 99 : Math.max(1, total)}
                        style={{ width: 80 }}
                        value={rank.mode === "share" ? rank.share : rank.at}
                        onChange={(event) => setRank(index, rank.mode === "share" ? "share" : "at", event.target.value)}
                        aria-label={rank.mode === "share" ? "Percent of films" : "Films needed"}
                      />
                      <span className={`rank-need ${tooFew ? "error" : ""}`}>
                        {rank.mode === "share" ? `= ${plural(counts[index], "film")}` : counts[index] === 1 ? "film" : "films"}
                      </span>
                    </>
                  )}
                  <button
                    className="btn btn-small"
                    disabled={ranks.length <= 1}
                    onClick={() => setRanks((current) => current.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
            <div>
              <button
                className="btn btn-small"
                disabled={ranks.length >= MAX_RANKS}
                onClick={() => setRanks((current) => [...current.slice(0, -1), toEditable({ title: "", at: 1 }), current.at(-1)])}
              >
                Add a rank
              </button>
            </div>
          </div>

          {/* The picture. */}
          <div className="card stack">
            <div>
              <h2>Picture</h2>
              <div className="muted">
                The top of the collection's page. Automatic uses the franchise's backdrop or the person's photo, else its best-known film's.
              </div>
            </div>
            <div className="art-grid">
              <button className={`art-option ${art ? "" : "on"}`} onClick={() => setArt(null)}>
                {imageOf(autoArt) && <img src={imageOf(autoArt)} alt="" />}
                <span className="art-label">Automatic</span>
              </button>
              {artChoices.map((choice) => (
                <button
                  key={imageOf(choice)}
                  className={`art-option ${imageOf(art) === imageOf(choice) ? "on" : ""} ${choice.photo ? "art-photo" : ""}`}
                  onClick={() => setArt(choice)}
                >
                  <img src={imageOf(choice)} alt="" loading="lazy" />
                  {choice.photo && <span className="art-label">Photo</span>}
                </button>
              ))}
            </div>
            {artChoices.length === 0 && <div className="muted">Add films to choose from their backdrops.</div>}
          </div>

          <div className="row wrap">
            <button className="btn btn-primary" disabled={problems.length > 0 || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : isNew ? "Create collection" : "Save collection"}
            </button>
            {problems.length > 0 && <span className="muted">Needs {problems.join(", ")}.</span>}
            {save.isSuccess && <span className="ok">Saved — live in the app.</span>}
            {save.isError && <span className="error">{save.error.message}</span>}
            <span className="spacer" />
            {!isNew && (
              <button
                className="btn btn-danger"
                disabled={remove.isPending}
                onClick={() => window.confirm(`Delete "${form.title}"? People lose their progress on it.`) && remove.mutate()}
              >
                Delete collection
              </button>
            )}
          </div>
        </div>

        <AppPreview form={form} art={shownArt} films={shownFilms} ranks={ranks} counts={counts} />
      </div>
    </div>
  );
};
