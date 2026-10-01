import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { prestartRiver } from "./river/sim/prestart.js";
import "@fontsource/roboto-mono/700.css";
import "./styles/variables.css";
import "./styles/global.css";

// Before the first render, so the river loads and warms up meanwhile.
prestartRiver();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
