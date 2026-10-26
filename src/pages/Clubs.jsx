import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, get, query } from "../api";
import { QueryState, formatDate, useDebounced } from "../components/shared";

// Every club, newest first: open one to clean it up, or remove it.
export const Clubs = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const clubs = useQuery({ queryKey: ["admin", "clubs", q], queryFn: () => get(`/admin/clubs${query({ q })}`) });
  const remove = useMutation({
    mutationFn: (clubId) => api("DELETE", `/admin/clubs/${clubId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Clubs</h1>
          <div className="sub">{clubs.data ? `${clubs.data.clubs.length} clubs` : " "}</div>
        </div>
      </div>
      <div className="toolbar">
        <input className="input grow" placeholder="Search by club name or owner's @handle" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {remove.isError && <p className="error">{remove.error.message}</p>}
      {clubs.data ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Club</th>
                <th>Owner</th>
                <th className="num">Members</th>
                <th className="num">Films</th>
                <th>Now watching</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {clubs.data.clubs.map((club) => (
                <tr key={club.id} className="clickable" onClick={() => navigate(`/clubs/${club.id}`)}>
                  <td>
                    <strong>{club.name}</strong>
                    {club.description && <div className="muted">{club.description}</div>}
                  </td>
                  <td>
                    {club.owner.name} <span className="muted">{club.owner.handle}</span>
                  </td>
                  <td className="num">{club.memberCount}</td>
                  <td className="num">{club.movieCount}</td>
                  <td className="muted">{club.nowWatching ?? "—"}</td>
                  <td className="muted">{formatDate(club.createdAt)}</td>
                  <td className="num">
                    <button
                      className="btn btn-danger btn-small"
                      disabled={remove.isPending}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (window.confirm(`Remove "${club.name}" for all ${club.memberCount} members? This can't be undone.`)) {
                          remove.mutate(club.id);
                        }
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {clubs.data.clubs.length === 0 && <div className="empty">No clubs yet.</div>}
        </div>
      ) : (
        <QueryState query={clubs} />
      )}
    </div>
  );
};
