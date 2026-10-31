import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { startSync } from "./app/sync";
import "./styles.css";
import "./v3.css";
import "./anim.css";
import "./clear.css";
import "./shop.css";
import "./ob.css";

startSync();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
