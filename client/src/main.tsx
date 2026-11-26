import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { USE_SERVER } from "./api/client";
import { seedDemo } from "./api/localBackend";
import "./index.css";

// In browser-only mode, make sure the demo account exists before the app starts.
await (USE_SERVER ? Promise.resolve() : seedDemo().catch(() => {}));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
