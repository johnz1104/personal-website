import { lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import PageLayout from "../components/PageLayout.jsx";
import writeups from "../writeups/index.js";

// Loaded only on a page with a write-up, with KaTeX's CSS (and Mermaid, if needed).
const WriteUp = lazy(() => import("../components/WriteUp.jsx"));

// The full write-up for one research item or project, looked up by URL slug.
// Every page shows its intro (or card text) and the "still being written" note; a
// page with a write-up (src/writeups) shows it below them.
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

  const writeup = writeups[slug];

  return (
    <PageLayout
      title={item.title}
      description={item.intro ?? item.description}
      backTo={backTo}
      centered
    >
      {item.repo && (
        <p className="page-link">
          <a href={item.repo} target="_blank" rel="noopener noreferrer">
            GitHub link ↗
          </a>
        </p>
      )}
      <p className="page-note">This page is still being written.</p>
      {writeup && (
        // Present from the first render, so the header's layout for write-up pages
        // (global.css, .writeup-slot) does not shift when the text arrives.
        <div className="writeup-slot">
          <Suspense fallback={null}>
            <WriteUp load={writeup} />
          </Suspense>
        </div>
      )}
    </PageLayout>
  );
}

export default DetailPage;
