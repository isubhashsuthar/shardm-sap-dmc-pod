import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";

sap.ui.define([], () => {
  return function CreateRoot(element, parentWidget) {
    const root = createRoot(element);
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  }
});
