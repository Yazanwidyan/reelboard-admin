import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { get } from "../api";
import { QueryState } from "../components/shared";

// Every collection (a "saga" to the API) with how far people have got.
export const Sagas = () => {
  const sagas = useQuery({ queryKey: ["admin", "sagas"], queryFn: () => get("/admin/sagas") });

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Collections</h1>
          <div className="sub">
            {sagas.data ? `${sagas.data.sagas.length} collections · ` : ""}Edits are live in the app and saved to data/curation.json.
          </div>
        </div>
        <Link to="/collections/new" className="btn btn-primary">
          New collection
        </Link>
      </div>
      {sagas.data ? (
        <div className="saga-cards">
          {sagas.data.sagas.map((saga) => (
            <Link key={saga.id} to={`/collections/${saga.id}`} className="saga-card">
              <div className="saga-cover">
                {saga.cover.map((movie) => (
                  <img key={movie.id} src={movie.poster} alt="" loading="lazy" />
                ))}
              </div>
              <div className="saga-body">
                <div className="row">
                  <span className="saga-title">{saga.title}</span>
                  <span className="spacer" />
                  <span className="badge">{saga.kind}</span>
                </div>
                <div className="muted">{saga.subtitle}</div>
                <div className="ranks">
                  {saga.ranks.map((rank) => (
                    <span key={rank.title} className="badge badge-rank">
                      {rank.title} · {rank.at}
                    </span>
                  ))}
                </div>
                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                  {saga.movieIds.length} films · {saga.started} started · {saga.finished} finished
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <QueryState query={sagas} />
      )}
    </div>
  );
};
