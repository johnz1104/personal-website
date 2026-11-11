import { useEffect, useState } from "react";

// "↑ Top" in the bottom-left corner of a long page, mirroring "← Back" in the top
// left. It shows once the reader is more than a screen down, and scrolls back up
// smoothly (at once with reduced motion). The author, 2026-11-11.
function BackToTop() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const update = () => setShown(window.scrollY > window.innerHeight);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const toTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      className="to-top"
      data-shown={shown ? "" : undefined}
      aria-hidden={!shown}
      tabIndex={shown ? 0 : -1}
      aria-label="Back to top"
      onClick={toTop}
    >
      ↑ Top
    </button>
  );
}

export default BackToTop;
