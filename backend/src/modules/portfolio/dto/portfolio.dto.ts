import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreatePortfolioSchema = z.object({
  name: z.string().min(1),
  userId: z.string().uuid(),
});

export class CreatePortfolioDto extends createZodDto(CreatePortfolioSchema) {}

export const AddAssetSchema = z.object({
  ticker: z
    .string()
    .min(1)
    .transform((val) => val.toUpperCase()),
  quantity: z.number().positive(),
  avgPrice: z.number().nonnegative(),
});

export class AddAssetDto extends createZodDto(AddAssetSchema) {}
