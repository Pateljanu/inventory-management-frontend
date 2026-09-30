import { createFileRoute } from "@tanstack/react-router"
import { RateAnalysisPage } from "@/features/rate-analysis/rate-analysis-page"
import { rateAnalysisSearchSchema } from "@/features/rate-analysis/search"

export const Route = createFileRoute("/_app/rate-analysis/")({
  staticData: { title: "Rate analysis" },
  validateSearch: rateAnalysisSearchSchema,
  component: function RateAnalysisRoute() {
    return <RateAnalysisPage search={Route.useSearch()} />
  },
})
