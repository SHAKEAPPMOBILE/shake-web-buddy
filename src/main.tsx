import React from "react";
import { createRoot } from "react-dom/client";
import './i18n'; // Initialize i18n before app renders
import App from "./App";
import "./index.css";
import { Capacitor } from "@capacitor/core";

if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add("capacitor-native");
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
