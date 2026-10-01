import { Link } from "react-router-dom";

// Research/project entries as a vertical timeline: a faint line to the left,
// a small square marker per entry, and a card with a title and description (no
// number: the entries are parallel, not ranked or in sequence).
// Each item needs `title`, `description` and `path`.
function TimelineList({ items }) {
  return (
    <ol className="timeline">
      {items.map((item) => (
        <li key={item.path} className="timeline-item">
          <span className="timeline-marker" aria-hidden="true" />
          <Link to={item.path} className="section-card timeline-card">
            <h2 className="timeline-card-title">{item.title}</h2>
            <p className="timeline-card-description">{item.description}</p>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export default TimelineList;
