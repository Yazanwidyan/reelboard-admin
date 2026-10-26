import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { get, query } from "../api";
import { Pager, QueryState, timeAgo } from "../components/shared";

// The kinds of change, as the log names them ("user.suspend" is a "user" one).
const KINDS = [
  ["", "Everything"],
  ["report", "Reports"],
  ["user", "Accounts"],
  ["list", "Lists"],
  ["club", "Clubs"],
  ["saga", "Collections"],
  ["movie", "Movies"],
];

// Where the thing a change was made to lives here (if it still does).
const linkTo = (target) =>
  target &&
  {
    user: `/users/${target.id}`,
    club: `/clubs/${target.id}`,
    saga: `/collections/${target.id}`,
    movie: `/movies/${target.id}`,
  }[target.type];

// Everything admins changed here, newest first.
export const Log = () => {
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const log = useQuery({
    queryKey: ["admin", "log", kind, page],
    queryFn: () => get(`/admin/log${query({ action: kind, page })}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Log</h1>
          <div className="sub">Everything admins changed here: who, what and when.</div>
        </div>
      </div>
      <div className="toolbar">
        <div className="segmented wrap">
          {KINDS.map(([key, label]) => (
            <button
              key={key || "all"}
              className={kind === key ? "on" : ""}
              onClick={() => {
                setKind(key);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {log.data ? (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>What</th>
                </tr>
              </thead>
              <tbody>
                {log.data.entries.map((entry) => {
                  const link = linkTo(entry.target);
                  return (
                    <tr key={entry.id}>
                      <td className="muted" style={{ whiteSpace: "nowrap" }} title={new Date(entry.createdAt).toLocaleString()}>
                        {timeAgo(entry.createdAt)}
                      </td>
                      <td className="muted">{entry.admin.email}</td>
                      <td>
                        <span className="badge" style={{ marginRight: 8 }}>
                          {entry.action}
                        </span>
                        {link ? <Link to={link}>{entry.summary}</Link> : entry.summary}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {log.data.entries.length === 0 && <div className="empty">Nothing logged yet.</div>}
          </div>
          <Pager page={page} totalPages={log.data.totalPages} total={log.data.total} onChange={setPage} />
        </>
      ) : (
        <QueryState query={log} />
      )}
    </div>
  );
};
