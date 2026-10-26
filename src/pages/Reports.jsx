import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { api, get, query } from "../api";
import { QueryState, formatDate, timeAgo } from "../components/shared";

const STATUSES = [
  ["open", "Open"],
  ["actioned", "Actioned"],
  ["dismissed", "Dismissed"],
];
const REASONS = {
  spam: "Spam or scam",
  offensive: "Offensive or hateful",
  harassment: "Harassment",
  impersonation: "Impersonation",
  other: "Something else",
};
const TYPE_LABELS = { user: "Person", list: "List", club: "Club" };

// Where to look at the reported thing here.
const targetLink = (item) =>
  item.targetType === "club" ? `/clubs/${item.targetId}` : item.targetType === "user" ? `/users/${item.targetId}` : item.owner && `/users/${item.owner.id}`;

// What the reported thing looks like now: a list's posters, a person's
// bio, a club's description.
const TargetPreview = ({ item }) => {
  if (item.gone) return <div className="muted">It's gone — deleted since it was reported.</div>;
  const { target } = item;
  if (item.targetType === "list") {
    return (
      <div className="row">
        <div className="mini-posters">
          {target.posters.slice(0, 4).map((poster, index) => (poster ? <img key={index} src={poster} alt="" /> : <span key={index} />))}
        </div>
        <span className="muted">
          {target.movieCount} {target.movieCount === 1 ? "film" : "films"}
        </span>
      </div>
    );
  }
  const text = item.targetType === "user" ? target.bio : target.description;
  return (
    <div className="case-quote">
      {text ? text : <span className="muted">{item.targetType === "user" ? "No bio." : "No description."}</span>}
      {item.targetType === "club" && <div className="muted">{target.memberCount} members</div>}
    </div>
  );
};

// One case: what was reported, every report about it, and closing it.
const Case = ({ item, status, onDone }) => {
  const [note, setNote] = useState("");
  const resolve = useMutation({
    mutationFn: (action) => api("POST", "/admin/reports/resolve", { targetType: item.targetType, targetId: item.targetId, action, note: note.trim() }),
    onSuccess: onDone,
  });
  const link = targetLink(item);
  const ownerCanBeSuspended = item.owner && !item.owner.suspended;
  const act = (action, question) => () => (!question || window.confirm(question)) && resolve.mutate(action);

  return (
    <div className="card case">
      <div className="row wrap">
        <span className="badge">{TYPE_LABELS[item.targetType]}</span>
        <strong className="case-title">{item.label}</strong>
        {item.owner && item.targetType !== "user" && (
          <span className="muted">
            by <Link to={`/users/${item.owner.id}`}>{item.owner.handle}</Link>
          </span>
        )}
        {item.owner?.suspended && <span className="badge badge-danger">Suspended</span>}
        <span className="spacer" />
        {status === "open" && (
          <span className={`badge ${item.reports.length > 1 ? "badge-danger" : ""}`}>
            {item.reports.length} {item.reports.length === 1 ? "report" : "reports"}
          </span>
        )}
        {link && !item.gone && (
          <Link to={link} className="btn btn-small">
            Open
          </Link>
        )}
      </div>

      <TargetPreview item={item} />

      <div className="case-reports">
        {item.reports.map((report) => (
          <div className="case-report" key={report.id}>
            <span className="badge badge-rank">{REASONS[report.reason]}</span>
            <span className="content-value">
              {report.note ? `“${report.note}”` : <span className="muted">No note.</span>}
            </span>
            <span className="muted case-meta">
              {report.reporter ? <Link to={`/users/${report.reporter.id}`}>{report.reporter.handle}</Link> : "a deleted account"} · {timeAgo(report.createdAt)}
            </span>
          </div>
        ))}
      </div>

      {status === "open" ? (
        <div className="stack" style={{ marginTop: 12 }}>
          <input className="input" placeholder="Note for the log (optional)" maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} />
          <div className="row wrap">
            {item.targetType !== "user" && !item.gone && (
              <button
                className="btn btn-danger"
                disabled={resolve.isPending}
                onClick={act("remove", `Remove the ${item.targetType} "${item.label}"? This can't be undone.`)}
              >
                Remove {item.targetType}
              </button>
            )}
            {ownerCanBeSuspended && (
              <button
                className="btn btn-danger"
                disabled={resolve.isPending}
                onClick={act("suspend", `Suspend ${item.owner.handle}? They're signed out at once, and hidden from everyone.`)}
              >
                Suspend {item.owner.handle}
              </button>
            )}
            <span className="spacer" />
            <button className="btn" disabled={resolve.isPending} onClick={act("handled")} title="You fixed it yourself, e.g. cleaned up their profile">
              Mark handled
            </button>
            <button className="btn" disabled={resolve.isPending} onClick={act("dismiss")}>
              Dismiss
            </button>
          </div>
          {resolve.isError && <div className="error">{resolve.error.message}</div>}
        </div>
      ) : (
        <div className="muted case-resolution">
          {item.resolution} · {item.resolvedBy ? item.resolvedBy.handle : "an admin"} · {formatDate(item.resolvedAt)}
        </div>
      )}
    </div>
  );
};

// What people reported from the app, one case per reported thing — the
// most-reported first.
export const Reports = () => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("open");
  const reports = useQuery({ queryKey: ["admin", "reports", status], queryFn: () => get(`/admin/reports${query({ status })}`) });
  const done = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <div className="sub">
            What people reported from the app: a person, one of their lists, or a club. Closing a case closes every report about it.
          </div>
        </div>
      </div>
      <div className="toolbar">
        <div className="segmented">
          {STATUSES.map(([key, label]) => (
            <button key={key} className={status === key ? "on" : ""} onClick={() => setStatus(key)}>
              {label}
              {key === "open" && reports.data?.open ? ` · ${reports.data.open}` : ""}
            </button>
          ))}
        </div>
      </div>
      {reports.data ? (
        reports.data.cases.length === 0 ? (
          <div className="card empty">{status === "open" ? "Nothing to look at — no open reports." : `No ${status} reports yet.`}</div>
        ) : (
          <div className="stack">
            {reports.data.cases.map((item) => (
              <Case key={`${item.key}:${item.resolvedAt ?? "open"}`} item={item} status={status} onDone={done} />
            ))}
          </div>
        )
      ) : (
        <QueryState query={reports} />
      )}
    </div>
  );
};
