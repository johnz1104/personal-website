// Detail pages with a write-up, by slug. Each is a Markdown file in this folder,
// turned into HTML when the site builds (vite.config.js) and loaded only when its
// page opens.
const writeups = {
  "cold-war-simulator": () => import("./cold-war-simulator.md"),
};

export default writeups;
