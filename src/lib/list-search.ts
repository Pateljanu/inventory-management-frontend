import { z } from "zod"
import { isDateOnly } from "./dates"

/*
 * URL search params shared by every list page. Filters, page, page size and open sheets live
 * in the URL, so Back restores the view, a refresh keeps an open form, and a filtered list can
 * be shared as a link. Every field falls back to "absent" when the URL holds junk.
 */

export const PAGE_SIZES = [25, 50, 100] as const
export type PageSize = (typeof PAGE_SIZES)[number]
export const DEFAULT_PAGE_SIZE: PageSize = 25

export const objectIdParam = z
  .string()
  .regex(/^[a-f\d]{24}$/i)
  .optional()
  .catch(undefined)

export const dateParam = z
  .string()
  .refine((v) => isDateOnly(v))
  .optional()
  .catch(undefined)

export const listSearchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().catch(undefined),
  limit: z.coerce
    .number()
    .refine((n): n is PageSize => (PAGE_SIZES as readonly number[]).includes(n))
    .optional()
    .catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  /** Opens the create sheet over the list. */
  create: z.boolean().optional().catch(undefined),
  /** Opens the edit sheet for this record id. */
  edit: objectIdParam,
})

export type ListSearch = z.infer<typeof listSearchSchema>

/** Filter changes always return to page 1. */
export const resetPage = { page: undefined }
