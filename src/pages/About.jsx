import PageLayout from "../components/PageLayout.jsx";
import photo from "../assets/about-photo.webp";

// Text takes the place of the homepage cards. The photo (cropped and converted from
// the author's photo; DECISIONS.md) sits on the left, and the text is a column
// beside it. Contact details may be added here later.
function About() {
  return (
    <PageLayout title="About Me">
      <div className="about">
        <img
          className="about-photo"
          src={photo}
          alt="Yuzhang (John) Zheng"
          width="480"
          height="600"
        />
        <div className="prose">
          <p>
            Student at UNC Chapel Hill studying Physics and Applied Mathematics. I
            love using math to describe how the world works and learning
            interesting approaches to challenging problems.
          </p>
          <p>
            My interests span the fields of mathematics, physics, and computer
            science, particularly across fluid dynamics, statistical mechanics,
            game theory, scientific computing, and machine learning.
          </p>
        </div>
      </div>
    </PageLayout>
  );
}

export default About;
