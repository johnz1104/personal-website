import { Link } from "react-router-dom";

function SectionCard({ id, title, path }) {
  return (
    <Link to={path} className="section-card">
      <span className="section-card-index">{id}</span>
      <h2 className="section-card-title">{title}</h2>
    </Link>
  );
}

export default SectionCard;
