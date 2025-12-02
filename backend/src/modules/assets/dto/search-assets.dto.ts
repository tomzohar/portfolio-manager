import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SearchAssetsSchema = z.object({
  q: z.string().min(1, 'Search term must not be empty'),
});

export class SearchAssetsDto extends createZodDto(SearchAssetsSchema) {}
