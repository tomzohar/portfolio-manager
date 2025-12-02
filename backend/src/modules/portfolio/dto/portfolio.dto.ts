import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreatePortfolioSchema = z.object({
  name: z.string().min(1),
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

// Response DTO for asset creation
export class AssetCreatedResponseDto {
  @ApiProperty({
    description: 'ID of the created asset',
  })
  id: string;
}
