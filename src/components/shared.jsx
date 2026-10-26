import { useEffect, useState } from "react";

// Small pieces every page uses.

export const useDebounced = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

export const formatDate = (timestamp) =>
  timestamp
    ? new Date(timestamp).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "—";

export const timeAgo = (timestamp) => {
  if (!timestamp) return "never";
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(timestamp);
};

export const number = (value) => (value ?? 0).toLocaleString();

export const Poster = ({ src, large = false, alt = "" }) =>
  src ? (
    <img src={src} alt={alt} className={large ? "poster-lg" : "poster"} loading="lazy" />
  ) : (
    <div className={large ? "poster-lg" : "poster"} />
  );

export const Avatar = ({ user }) =>
  user.avatarUri?.startsWith("http") ? (
    <img src={user.avatarUri} alt="" className="avatar" style={{ objectFit: "cover" }} />
  ) : (
    <div className="avatar" style={{ background: user.color ?? "#8a8f98" }}>
      {(user.name ?? user.displayName ?? "?").slice(0, 1).toUpperCase()}
    </div>
  );

export const Pager = ({ page, totalPages, total, onChange }) =>
  totalPages > 1 ? (
    <div className="pager">
      <span>
        {number(total)} · page {page} of {totalPages}
      </span>
      <button className="btn btn-small" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <button className="btn btn-small" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </div>
  ) : null;

export const Tile = ({ label, value, sub }) => (
  <div className="tile">
    <div className="tile-label">{label}</div>
    <div className="tile-value">{value}</div>
    {sub && <div className="tile-sub">{sub}</div>}
  </div>
);

export const QueryState = ({ query, empty }) => {
  if (query.isPending) return <div className="empty">Loading…</div>;
  if (query.isError) return <div className="empty error">{query.error.message}</div>;
  if (empty) return <div className="empty">{empty}</div>;
  return null;
};

// ---- Charts: one series, so one hue and no legend (the title names it);
// thin marks with a rounded data end, a 2px gap between columns, and a
// tooltip on every mark.

// Columns over time — e.g. sign-ups per day. `points`: [{ label, value }].
export const ColumnChart = ({ points, valueLabel, title }) => {
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(1, ...points.map((point) => point.value));
  return (
    <div className="chart">
      <div className="columns" role="img" aria-label={`${title}: ${points.map((p) => `${p.label} ${p.value}`).join(", ")}`}>
        <span className="chart-max">{max}</span>
        {points.map((point, index) => (
          <div
            key={point.label}
            className="column"
            onMouseEnter={() => setHover(index)}
            onMouseLeave={() => setHover(null)}
          >
            <div className="column-bar" style={{ height: `${(point.value / max) * 100}%` }} />
          </div>
        ))}
        {hover !== null && (
          <div
            className="tooltip"
            style={{ left: `${((hover + 0.5) / points.length) * 100}%`, top: `${100 - (points[hover].value / max) * 100}%` }}
          >
            <strong>{points[hover].value}</strong> {valueLabel}
            <div className="muted">{points[hover].label}</div>
          </div>
        )}
      </div>
      <div className="chart-axis">
        <span>{points[0]?.label}</span>
        <button className="link-button" onClick={() => setShowTable((value) => !value)}>
          {showTable ? "Hide table" : "Show as table"}
        </button>
        <span>{points.at(-1)?.label}</span>
      </div>
      {showTable && (
        <table className="table" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Date</th>
              <th className="num">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.label}>
                <td>{point.label}</td>
                <td className="num">{point.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

// A ranked list with a bar each and the value at the bar's tip — e.g. most
// watched movies. `items`: [{ key, label, sublabel?, value, image? }].
export const BarList = ({ items, valueLabel }) => {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="hbars">
      {items.map((item) => (
        <div className="hbar" key={item.key} title={`${item.label}: ${item.value} ${valueLabel}`}>
          <Poster src={item.image} />
          <div style={{ minWidth: 0 }}>
            <div className="hbar-name">
              {item.label} {item.sublabel && <span className="muted">{item.sublabel}</span>}
            </div>
            <div className="hbar-track">
              <div className="hbar-fill" style={{ width: `${Math.max(2, (item.value / max) * 85)}%` }} />
              <span className="hbar-value">{item.value}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
