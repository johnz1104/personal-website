import { useParams } from "react-router-dom";
import PageLayout from "../components/PageLayout.jsx";

// The full write-up for one research item or project, looked up by URL slug.
// Until an entry has a write-up, the page shows its intro (or card text) and a note.
function DetailPage({ items, backTo }) {
  const { slug } = useParams();
  const item = items.find((entry) => entry.slug === slug);

  if (!item) {
    return (
      <PageLayout
        title="Not found"
        description="There is no page at this address."
        backTo={backTo}
        centered
      />
    );
  }

  return (
    <PageLayout
      title={item.title}
      description={item.intro ?? item.description}
      backTo={backTo}
      centered
    >
      <p className="page-note">This page is still being written.</p>
    </PageLayout>
  );
}

export default DetailPage;
