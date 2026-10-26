import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { get, query } from "../api";
import { Avatar, Pager, QueryState, formatDate, number, timeAgo, useDebounced } from "../components/shared";

export const Users = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());
  const users = useQuery({
    queryKey: ["admin", "users", q, status, page],
    queryFn: () => get(`/admin/users${query({ q, status, page })}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Users</h1>
          <div className="sub">{users.data ? `${number(users.data.total)} accounts` : " "}</div>
        </div>
      </div>
      <div className="toolbar">
        <div className="segmented">
          {[
            ["all", "All"],
            ["suspended", "Suspended"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={status === key ? "on" : ""}
              onClick={() => {
                setStatus(key);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          className="input grow"
          placeholder="Search by name, @handle or email"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </div>
      {users.data ? (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th />
                  <th>Name</th>
                  <th>Email</th>
                  <th>Title</th>
                  <th className="num">Ranks</th>
                  <th className="num">Watched</th>
                  <th>Joined</th>
                  <th>Last active</th>
                </tr>
              </thead>
              <tbody>
                {users.data.users.map((user) => (
                  <tr key={user.id} className="clickable" onClick={() => navigate(`/users/${user.id}`)}>
                    <td style={{ width: 40 }}>
                      <Avatar user={user} />
                    </td>
                    <td>
                      <strong>{user.name}</strong> <span className="muted">{user.handle}</span>
                      {user.suspendedAt && <span className="badge badge-danger" style={{ marginLeft: 6 }}>Suspended</span>}
                    </td>
                    <td className="muted">{user.email}</td>
                    <td>{user.title}</td>
                    <td className="num">{user.ranks}</td>
                    <td className="num">{number(user.watchedCount)}</td>
                    <td className="muted">{formatDate(user.createdAt)}</td>
                    <td className="muted">{timeAgo(user.lastActive)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.data.users.length === 0 && <div className="empty">{status === "suspended" ? "No suspended accounts." : "No accounts match."}</div>}
          </div>
          <Pager page={page} totalPages={users.data.totalPages} total={users.data.total} onChange={setPage} />
        </>
      ) : (
        <QueryState query={users} />
      )}
    </div>
  );
};
