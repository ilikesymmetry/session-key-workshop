import { Buffer } from "buffer";
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.tsx";

import "./index.css";
import OnchainProviders from "./OnchainProviders.tsx";

globalThis.Buffer = Buffer;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OnchainProviders>
      <App />
    </OnchainProviders>
  </React.StrictMode>
);
