import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PortfolioRiskProfile } from '../entities/portfolio.entity';

export const CreatePortfolioSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  initialInvestment: z.number().nonnegative().optional(),
  riskProfile: z.nativeEnum(PortfolioRiskProfile).optional(),
});

export class CreatePortfolioDto extends createZodDto(CreatePortfolioSchema) {}
