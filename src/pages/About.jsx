import PageLayout from "../components/PageLayout.jsx";
import photo from "../assets/about-photo.webp";

// Text takes the place of the homepage cards. The photo (cropped and converted from
// the author's photo; DECISIONS.md) sits on the left with the first paragraph beside
// it; later paragraphs run under both. Contact details are in the Contact menu at
// the bottom left (ContactMenu.jsx).
function About() {
  return (
    <PageLayout title="About Me">
      <div className="about prose">
        <img
          className="about-photo"
          src={photo}
          alt="Yuzhang (John) Zheng"
          width="480"
          height="600"
        />
        <p>
          Student at UNC Chapel Hill studying Physics and Applied Mathematics. I
          love using math to describe how the world works and learning
          interesting approaches to challenging problems. I&nbsp;believe that what{" "}
          <em>can</em> be modeled by math can be <em>perfectly</em> modeled by
          math. The only limitations lie in the creativity of whoever builds the
          model and in computational power.
        </p>
        <p className="about-wide">
          My interests span the fields of mathematics, physics, and computer
          science, particularly in fluid dynamics, statistical mechanics, game
          theory, scientific computing, and machine learning.
        </p>
      </div>
    </PageLayout>
  );
}

export default About;
