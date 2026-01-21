import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * DTO for resuming a suspended graph execution
 * Task 3.3.2: Create Resume Endpoint
 */
const ResumeGraphSchema = z.object({
  threadId: z
    .string()
    .min(1, 'threadId is required')
    .refine(
      (val) => val.includes(':'),
      'threadId must be in format userId:threadId',
    ),
  userInput: z.string().min(1, 'userInput cannot be empty'),
});

export class ResumeGraphDto extends createZodDto(ResumeGraphSchema) {}
