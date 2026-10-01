import { Link } from "react-router-dom";

// Shared wrapper for every page except the homepage. The title sits where the
// homepage name does, and the back link sits in the padding above it.
// `centered` puts the column in the middle of the window (detail pages).
function PageLayout({ title, description, backTo = "/", centered = false, children }) {
  return (
    <main className={centered ? "page page--centered" : "page"}>
      <Link to={backTo} className="back-link">
        ← Back
      </Link>
      <header>
        <h1 className="site-name">{title}</h1>
        {description && <p className="intro">{description}</p>}
      </header>
      {children}
    </main>
  );
}

export default PageLayout;
