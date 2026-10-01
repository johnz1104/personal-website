import CardList from "../components/CardList.jsx";
import sections from "../data/sections.js";

function Home() {
  return (
    <main className="page">
      <header>
        <h1 className="site-name">Yuzhang (John) Zheng</h1>
        <p className="intro">Hi, welcome to my site. The river will keep you company.</p>
      </header>

      <CardList items={sections} />
    </main>
  );
}

export default Home;
