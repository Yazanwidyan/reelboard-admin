import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { get } from "../api";
import { BarList, ColumnChart, QueryState, Tile, number } from "../components/shared";

// The app at a glance: people, what they do, what they watch, which
// collections they climb.
export const Dashboard = () => {
  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: () => get("/admin/stats") });
  if (!stats.data) return <QueryState query={stats} />;
  const { users, signups, totals, topWatched, topS, sagas } = stats.data;
  const day = (date) => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const maxStarted = Math.max(1, ...sagas.map((saga) => saga.started));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">Active means did something the feed records — watched, tiered, saved.</div>
        </div>
        <button className="btn" onClick={() => stats.refetch()} disabled={stats.isFetching}>
          {stats.isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="tiles">
        <Tile label="Accounts" value={number(users.total)} sub={`+${users.new7} this week · +${users.new30} this month`} />
        <Tile label="Active today" value={number(users.active1)} sub={`${users.active7} this week · ${users.active30} this month`} />
        <Tile label="Movies watched" value={number(totals.watched)} sub={`${number(totals.tiered)} tiered`} />
        <Tile label="On watchlists" value={number(totals.watchlist)} />
        <Tile label="Lists · clubs" value={`${number(totals.boards)} · ${number(totals.clubs)}`} sub={`${number(totals.friendships)} friendships`} />
        <Tile label="Pool" value={number(totals.poolMovies)} sub={`${totals.handTuned} hand-tuned · ${number(totals.otherMovies)} more cached`} />
      </div>

      <div className="card">
        <h2>Sign-ups, last 30 days</h2>
        <ColumnChart
          title="Sign-ups per day"
          valueLabel="sign-ups"
          points={signups.map((point) => ({ label: day(point.date), value: point.count }))}
        />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Most watched, last 30 days</h2>
          {topWatched.length === 0 ? (
            <div className="muted">Nothing watched yet.</div>
          ) : (
            <BarList
              valueLabel="watches"
              items={topWatched.map((movie) => ({
                key: movie.id,
                label: movie.title,
                sublabel: movie.year,
                value: movie.count,
                image: movie.poster,
              }))}
            />
          )}
        </div>
        <div className="card">
          <h2>Most S-tiered, ever</h2>
          {topS.length === 0 ? (
            <div className="muted">No S tiers yet.</div>
          ) : (
            <BarList
              valueLabel="S tiers"
              items={topS.map((movie) => ({
                key: movie.id,
                label: movie.title,
                sublabel: movie.year,
                value: movie.count,
                image: movie.poster,
              }))}
            />
          )}
        </div>
      </div>

      <div className="card">
        <h2>Collections: how many started, how many finished</h2>
        <div className="table-wrap" style={{ background: "transparent" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Collection</th>
                <th>Kind</th>
                <th className="num">Films</th>
                <th style={{ width: "40%" }}>Started</th>
                <th className="num">Finished</th>
              </tr>
            </thead>
            <tbody>
              {sagas.map((saga) => (
                <tr key={saga.id}>
                  <td>
                    <Link to={`/collections/${saga.id}`}>{saga.title}</Link>
                  </td>
                  <td className="muted">{saga.kind}</td>
                  <td className="num">{saga.films}</td>
                  <td>
                    <div className="hbar-track" style={{ marginTop: 0 }} title={`${saga.started} started`}>
                      <div className="hbar-fill" style={{ width: `${Math.max(1, (saga.started / maxStarted) * 85)}%` }} />
                      <span className="hbar-value">{saga.started}</span>
                    </div>
                  </td>
                  <td className="num">{saga.finished}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
