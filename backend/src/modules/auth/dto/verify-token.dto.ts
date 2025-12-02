import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const VerifyTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export class VerifyTokenDto extends createZodDto(VerifyTokenSchema) {}
