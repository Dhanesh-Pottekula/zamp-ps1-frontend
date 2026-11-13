import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { Layout } from "@/components/layout";
import { ProcessPage } from "@/pages/process";
import { RunPage } from "@/pages/run";
import { DashboardPage } from "@/pages/dashboard";
import { MasterPage } from "@/pages/master";
import { ManualPage } from "@/pages/manual";
import { NotFoundPage } from "@/pages/not-found";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element missing");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<ProcessPage />} />
          <Route path="runs/:id" element={<RunPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="master" element={<MasterPage />} />
          <Route path="manual" element={<ManualPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
