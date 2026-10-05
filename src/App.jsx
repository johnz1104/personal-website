import { Routes, Route } from "react-router-dom";
import RiverLayout from "./components/RiverLayout.jsx";
import Home from "./pages/Home.jsx";
import Research from "./pages/Research.jsx";
import Projects from "./pages/Projects.jsx";
import About from "./pages/About.jsx";
import DetailPage from "./pages/DetailPage.jsx";
import research from "./data/research.js";
import projects from "./data/projects.js";
import { homeBank } from "./river/banks.js";

// Pages inside one RiverLayout share a single running river, except that each detail
// page has its own (RiverLayout keys its river by page). The different keys make React
// start a new river when crossing between the homepage pages and the detail pages.
function App() {
  return (
    <Routes>
      <Route element={<RiverLayout key="home" bank={homeBank} />}>
        <Route path="/" element={<Home />} />
        <Route path="/research" element={<Research />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/about" element={<About />} />
      </Route>

      {/* Each detail page has its own placeholder river (config.js, detailRivers.js). */}
      <Route element={<RiverLayout key="detail" bank={homeBank} />}>
        <Route
          path="/research/:slug"
          element={<DetailPage items={research} backTo="/research" />}
        />
        <Route
          path="/projects/:slug"
          element={<DetailPage items={projects} backTo="/projects" />}
        />
      </Route>
    </Routes>
  );
}

export default App;
