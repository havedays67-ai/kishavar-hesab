import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ProfileProvider } from "./lib/profile";
import { SignatureProvider } from "./lib/signatureContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ProfileProvider>
      <SignatureProvider>
        <App />
      </SignatureProvider>
    </ProfileProvider>
  </StrictMode>
);
