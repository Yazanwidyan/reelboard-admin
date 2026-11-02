import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { get } from "../api";
import { BarList, ColumnChart, QueryState, Tile, number } from "../components/shared";

// The app at a glance: people, what they do, what they watch, which
// collections they climb.
export const Dashboard = () => {
  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: () => get("/admin/stats") });
  if (!stats.data) return <QueryState query={stats} />;
  const { launch, users, signups, totals, topWatched, topS, sagas } = stats.data;
  const percent = ({ rate }) => (rate == null ? "—" : `${Math.round(rate * 100)}%`);
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

      {/* The three launch numbers — from what the app reports (/api/events). */}
      <div className="tiles">
        <Tile
          label="Finished onboarding"
          value={percent(launch.onboardingCompleted)}
          sub={`${launch.onboardingCompleted.part} of ${launch.onboardingCompleted.whole} who joined in 30 days`}
        />
        <Tile
          label="Shared their Taste DNA"
          value={percent(launch.dnaShared)}
          sub={`${launch.dnaShared.part} of ${launch.dnaShared.whole} who finished onboarding`}
        />
        <Tile
          label="Picks watched"
          value={percent(launch.pickAcceptance)}
          sub={`${launch.pickAcceptance.part} of ${launch.pickAcceptance.whole} who picked a film for tonight`}
        />
        <Tile
          label="Back after a week"
          value={percent(launch.day7Return)}
          sub={`${launch.day7Return.part} of ${launch.day7Return.whole} who joined 7–37 days ago`}
        />
      </div>

      {/* Onboarding, step by step, for the same people — where they stop. */}
      <div className="card">
        <h2>Onboarding, step by step</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Step (joined in the last 30 days)</th>
                <th className="num">People</th>
                <th className="num">Of sign-ups</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Saw the welcome screen (phones)", launch.funnel.welcomeViewed],
                ["Tapped a way to sign in (phones)", launch.funnel.signinTapped],
                ["Signed in (phones)", launch.funnel.signedInDevices],
                ["Signed up", launch.funnel.signedUp],
                ["Marked films seen", launch.funnel.seen],
                ["Saw their Taste DNA", launch.funnel.dna],
                ["Reached the pick", launch.funnel.pick],
                ["Finished onboarding", launch.funnel.completed],
                ["Skipped onboarding", launch.funnel.skipped],
                ["Allowed reminders", launch.funnel.notificationsAllowed],
                ["Picked a film for tonight", launch.funnel.pickAccepted],
                ["Saved it for later instead", launch.funnel.pickLater],
                ["Next morning: watched it", launch.funnel.nudgeWatched],
                ["Next morning: didn't watch it", launch.funnel.nudgeNotWatched],
                ["Watched their pick", launch.funnel.pickWatched],
                ["Tiered it (activated)", launch.funnel.activated],
              ].map(([label, value]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td className="num">{number(value)}</td>
                  <td className="num">{percent({ rate: launch.funnel.signedUp ? value / launch.funnel.signedUp : null })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tiles">
        <Tile label="Accounts" value={number(users.total)} sub={`+${users.new7} this week · +${users.new30} this month`} />
        <Tile label="Active today" value={number(users.active1)} sub={`${users.active7} this week · ${users.active30} this month`} />
        <Tile label="Movies watched" value={number(totals.watched)} sub={`${number(totals.tiered)} tiered`} />
        <Tile label="On watchlists" value={number(totals.watchlist)} />
        <Tile label="Lists" value={number(totals.boards)} sub={`${number(totals.friendships)} friendships`} />
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
