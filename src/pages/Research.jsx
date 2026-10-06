import ItemList from "../components/ItemList.jsx";
import PageLayout from "../components/PageLayout.jsx";
import research from "../data/research.js";

function Research() {
  return (
    <PageLayout
      title="Research"
      description="My research interests and ongoing work."
      scrolls
    >
      <ItemList
        items={research.map((item) => ({ ...item, path: `/research/${item.slug}` }))}
      />
    </PageLayout>
  );
}

export default Research;
