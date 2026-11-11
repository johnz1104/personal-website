import { useEffect, useRef, useState } from "react";
import "katex/dist/katex.min.css";

// Mermaid's colours and type, from the site's (variables.css): black lines and text
// on the cream page, cards' off-white inside the boxes, the monospace font.
const MERMAID = {
  startOnLoad: false,
  theme: "base",
  securityLevel: "strict",
  themeVariables: {
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
    fontSize: "13px",
    background: "#f5f1e8",
    primaryColor: "#fdfbf6",
    primaryBorderColor: "#111111",
    primaryTextColor: "#111111",
    lineColor: "#111111",
    textColor: "#111111",
  },
  flowchart: { curve: "basis", padding: 12 },
};

// A detail page's write-up: HTML built from its Markdown (src/writeups), with the
// maths already typeset. Mermaid diagrams are drawn here, after the HTML is in, by
// Mermaid loaded only for pages that have one.
function WriteUp({ load }) {
  const [html, setHtml] = useState(null);
  const article = useRef(null);

  useEffect(() => {
    let live = true;
    load().then((module) => live && setHtml(module.default));
    return () => {
      live = false;
    };
  }, [load]);

  useEffect(() => {
    const root = article.current;
    if (html === null || !root) return undefined;
    let live = true;
    const diagrams = [...root.querySelectorAll("pre.mermaid:not([data-processed])")];
    if (diagrams.length) {
      // A diagram that fails to draw keeps its source text; the page carries on.
      import("mermaid")
        .then(({ default: mermaid }) => {
          if (!live) return undefined;
          mermaid.initialize(MERMAID);
          return mermaid.run({ nodes: diagrams });
        })
        .catch((error) => console.error("Mermaid could not draw a diagram:", error));
    }
    // A link straight to a section (…#4-game-theory-and-decision-making) arrives
    // before the text exists; go there once it does.
    const { hash } = window.location;
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
    return () => {
      live = false;
    };
  }, [html]);

  return (
    <article
      ref={article}
      className="prose writeup"
      aria-busy={html === null}
      dangerouslySetInnerHTML={{ __html: html ?? "" }}
    />
  );
}

export default WriteUp;
