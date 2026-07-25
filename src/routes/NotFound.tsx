import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="not-found">
      {/* The code is metadata; what happened is the headline. */}
      <p className="not-found-code">
        <code>ObjectNotFound</code>
      </p>
      <h1>Nothing lives at this address.</h1>
      <p>
        The short link may be mistyped, or it may never have existed. Either
        way, the front door still works.
      </p>
      <Link to="/" className="button button-primary">
        Back to pwsh.ca
      </Link>
    </section>
  );
}
