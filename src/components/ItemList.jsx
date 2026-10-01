import CardList from "./CardList.jsx";
import TimelineList from "./TimelineList.jsx";

// How the Research and Projects pages list their entries.
// "timeline": line, markers and cards with descriptions (TimelineList).
// "cards": the homepage-style boxes (CardList). Set this to revert.
const LIST_STYLE = "timeline";

function ItemList({ items }) {
  return LIST_STYLE === "timeline" ? (
    <TimelineList items={items} />
  ) : (
    <CardList items={items} />
  );
}

export default ItemList;
