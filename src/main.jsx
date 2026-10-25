import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import "./theme.css";
import "./App.css";
import "./hc-polish.css";
import "./responsive.css";
import "./hcWorkflowBridge.js";
import "./hcNoEmoji.js";
import "./hcOrderRealtime.js";
import "./hcQRRepair.jsx";
import "./hcOrderPolicy.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
