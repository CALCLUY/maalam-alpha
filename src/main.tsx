import { createRoot } from "react-dom/client";
import "./globals.css";
import "./maalam.css";
import "./clean.css";
import "@sohumsuthar/liquid-glass/css/liquid-glass-core.css";
import "./liquid-glass.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);
