import SectionCard from "./SectionCard.jsx";

// Stacked cards, as on the homepage. Each item needs `id`, `title` and `path`.
function CardList({ items }) {
  return (
    <ul className="card-list">
      {items.map((item) => (
        <li key={item.path}>
          <SectionCard {...item} />
        </li>
      ))}
    </ul>
  );
}

export default CardList;
