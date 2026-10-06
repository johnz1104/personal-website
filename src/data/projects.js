// Entries on the Projects page, in display order (the author's). Descriptions are
// written from the author's notes.
// Each `slug` becomes the detail page URL: /projects/<slug>. `description` is the
// card's text; `intro` (optional) opens the detail page in its place; `repo`
// (optional) links the code from the detail page.
const projects = [
  {
    id: "01",
    slug: "cold-war-simulator",
    title: "Cold War Strategy Simulator",
    description:
      "Cold War events modeled with a game-theoretic framework, using multi-agent reinforcement learning to train agents that play as competing countries.",
  },
  {
    id: "02",
    slug: "cfd-research-library",
    title: "CFD Research Library",
    description:
      "A computational fluid dynamics (CFD) library of the simulation and analysis tools I use in my research.",
  },
  {
    id: "03",
    slug: "web-river-simulator",
    title: "Web River Simulator",
    description:
      "The river behind this site: a lattice Boltzmann fluid solver written in C++, compiled to WebAssembly, and painted live from its flow.",
    intro:
      "The river behind this site is a live lattice Boltzmann simulation, written in C++ and run in the browser through WebAssembly. The simulated currents carry painted brush strokes across the water, and the simulation runs four times slower than real time, so a fast, turbulent river moves in slow motion.",
    repo: "https://github.com/johnz1104/web-river-sim",
  },
  {
    id: "04",
    slug: "stochastic-fourier-neural-operator",
    title: "Stochastic Fourier Neural Operator",
    description:
      "A neural operator trained to learn solutions of the 1D stochastic Burgers' equation and the 2D stochastic Navier–Stokes equations.",
  },
  {
    id: "05",
    slug: "n-body-solver",
    title: "Differentiable N-Body Solver",
    description:
      "Simulates how gravitational N-body systems evolve, and uses its gradients to infer what telescopes can't measure directly, like masses and initial conditions, from observed motions.",
  },
];

export default projects;
