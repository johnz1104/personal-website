import ItemList from "../components/ItemList.jsx";
import PageLayout from "../components/PageLayout.jsx";
import projects from "../data/projects.js";

function Projects() {
  return (
    <PageLayout
      title="Projects"
      description="Fun side projects and software tools I've built."
      scrolls
    >
      <ItemList
        items={projects.map((item) => ({ ...item, path: `/projects/${item.slug}` }))}
      />
    </PageLayout>
  );
}

export default Projects;
