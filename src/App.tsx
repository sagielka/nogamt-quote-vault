import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { GitHubCatalogProvider } from "@/components/GitHubCatalogProvider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Unsubscribe from "./pages/Unsubscribe";
import CustomerPortal from "./pages/CustomerPortal";
import CustomerPrices from "./pages/CustomerPrices";
import NotFound from "./pages/NotFound";
import Versions from "./pages/Versions";

import DesktopUpdater from "./components/DesktopUpdater";
import UpdateBanner from "./components/UpdateBanner";
import { useVersionReporter } from "./hooks/useVersionReporter";


const queryClient = new QueryClient();

const VersionReporter = () => {
  useVersionReporter();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <GitHubCatalogProvider>
        <Toaster />
        <Sonner />
        <DesktopUpdater />
        <UpdateBanner />
        <VersionReporter />


        <HashRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/portal" element={<CustomerPortal />} />
            <Route path="/price-list" element={<CustomerPrices />} />
            <Route path="/versions" element={<Versions />} />


            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </GitHubCatalogProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
