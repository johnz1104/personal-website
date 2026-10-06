// Entries on the Projects page, in display order (the author's). Descriptions are
// written from the author's notes.
// Each `slug` becomes the detail page URL: /projects/<slug>. `description` is the
// card's text; `intro` (optional) opens the detail page in its place.
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
    slug: "stochastic-fourier-neural-operator",
    title: "Stochastic Fourier Neural Operator",
    description:
      "A neural operator trained to learn solutions of the 1D stochastic Burgers' equation and the 2D stochastic Navier–Stokes equations.",
  },
  {
    id: "04",
    slug: "n-body-solver",
    title: "Differentiable N-Body Solver",
    description:
      "Simulates how gravitational N-body systems evolve, and uses its gradients to infer what telescopes can't measure directly, like masses and initial conditions, from observed motions.",
  },
];

export default projects;
