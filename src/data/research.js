// Entries on the Research page, in display order.
// Each `slug` becomes the detail page URL: /research/<slug>. `description` is the
// card's text; `intro` (optional) opens the detail page in its place.
const research = [
  {
    id: "01",
    slug: "effective-turbulence-laws",
    title: "Learning Turbulence Laws from Incomplete Information",
    description:
      "Can partial observations identify transferable, physically consistent turbulence closure laws? I explore this using Bayesian inference in RANS turbulence modeling.",
    intro:
      "Can partial observations reveal a transferable, physically consistent description of unresolved turbulence? I use Bayesian inference to learn which closure laws the data support, with RANS turbulence models calibrated against high-fidelity simulations as the testbed.",
  },
  {
    id: "02",
    slug: "spontaneous-stochasticity",
    title: "Spontaneous Stochasticity in Turbulence",
    description:
      "Turbulent flow can still have multiple futures, even as viscosity and uncertainty in its initial conditions go to zero. How do we describe the randomness that remains?",
    intro:
      "How does randomness persist in turbulent flow as viscosity and uncertainty in its initial conditions go to zero? Using the Sabra shell model and related multiscale models, I explore the mechanisms, universality, and memory of this randomness, and what it means for predictability.",
  },
  {
    id: "03",
    slug: "scramjet-inlet-unstart",
    title: "Scramjet Unstart and Wall Motion Study",
    description:
      "In a scramjet, small changes to the inlet's walls can reshape the flow through the whole engine. I study how wall shape and oscillation drive these dynamics, combining reduced-order models with high-fidelity simulations.",
    intro:
      "How do the shape and oscillation of a scramjet inlet's walls affect the engine's performance and its risk of unstart, where the shock system is pushed out of the inlet and thrust is suddenly lost? I study this with a hybrid approach, using reduced-order models to map families of inlet geometries and wall motions and high-fidelity simulations to resolve the cases that matter most.",
  },
];

export default research;
