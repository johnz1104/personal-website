import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

// Whether a scrolling page has more below the part in view. Off when `enabled` is
// false.
function useMoreBelow(ref, enabled) {
  const [more, setMore] = useState(false);
  useEffect(() => {
    const page = ref.current;
    if (!enabled || !page) return undefined;
    const update = () => {
      setMore(page.scrollTop + page.clientHeight < page.scrollHeight - 1);
    };
    // Called once on observing, then whenever the window or the content changes size.
    const observer = new ResizeObserver(update);
    observer.observe(page);
    for (const child of page.children) observer.observe(child);
    page.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      page.removeEventListener("scroll", update);
    };
  }, [ref, enabled]);
  return more;
}

// Shared wrapper for every page except the homepage. The title sits where the
// homepage name does, and the back link sits in the padding above it.
// `centered` puts the column in the middle of the window (detail pages).
// `scrolls` (Research, Projects) keeps the page in the space above the Contact menu:
// it scrolls there, and while more is below, its cards fade out at the bottom (the
// author, 2026-10-06).
function PageLayout({
  title,
  description,
  backTo = "/",
  centered = false,
  scrolls = false,
  children,
}) {
  const page = useRef(null);
  const more = useMoreBelow(page, scrolls);
  const className = ["page", centered && "page--centered", scrolls && "page--scroll"]
    .filter(Boolean)
    .join(" ");
  return (
    <main ref={page} className={className} data-more={more ? "" : undefined}>
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
