import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"

import "./index.css"
import { PreferencesProvider } from "@/components/providers/preferences-provider"
import { createQueryClient } from "@/lib/query-client"
import { createAppRouter } from "./router"

const queryClient = createQueryClient()
const router = createAppRouter(queryClient)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PreferencesProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </PreferencesProvider>
  </StrictMode>
)
