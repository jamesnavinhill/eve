import { z } from "zod";

export const searchInputSchema = z.strictObject({
  query: z.string().min(1).describe("The search query."),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe("Maximum number of results to return. Defaults to 10."),
});

export const searchResultSchema = z.strictObject({
  title: z.string(),
  url: z.string(),
  content: z.string(),
});

export const searchOutputSchema = z.strictObject({
  answer: z.string().optional(),
  results: z.array(searchResultSchema),
});

export type SearchOutput = z.infer<typeof searchOutputSchema>;

export interface SearchProvider {
  readonly name: string;
  search(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchOutput>;
}
