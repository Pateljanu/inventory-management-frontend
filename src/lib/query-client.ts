import { QueryClient } from "@tanstack/react-query"
import { isApiError } from "./api-client"

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        // Retry only transient failures (network, 5xx, 429); a 4xx will not fix itself.
        retry: (count, error) => {
          if (isApiError(error) && error.status >= 400 && error.status < 500 && error.status !== 429)
            return false
          return count < 2
        },
      },
      mutations: {
        // Stock and money saves are never retried automatically: the server may reject them
        // (409) and a blind retry could double-record a truck.
        retry: false,
      },
    },
  })
}
