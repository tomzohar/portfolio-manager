import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { TransactionType } from '../entities/transaction.entity';

// Create Transaction DTO (Zod schema)
export const CreateTransactionSchema = z.object({
  type: z.nativeEnum(TransactionType),
  ticker: z
    .string()
    .min(1)
    .transform((val) => val.toUpperCase()),
  quantity: z.number().positive(),
  price: z.number().nonnegative(),
  transactionDate: z.coerce
    .date()
    .optional()
    .default(() => new Date()),
});

export class CreateTransactionDto extends createZodDto(
  CreateTransactionSchema,
) {}

// Transaction Response DTO
export class TransactionResponseDto {
  @ApiProperty({
    description: 'Transaction ID',
  })
  id: string;

  @ApiProperty({
    description: 'Transaction type',
    enum: TransactionType,
  })
  type: TransactionType;

  @ApiProperty({
    description: 'Ticker symbol',
  })
  ticker: string;

  @ApiProperty({
    description: 'Quantity of shares',
    type: 'number',
  })
  quantity: number;

  @ApiProperty({
    description: 'Price per share',
    type: 'number',
  })
  price: number;

  @ApiProperty({
    description: 'Total value (quantity * price)',
    type: 'number',
  })
  totalValue: number;

  @ApiProperty({
    description: 'Date when transaction occurred',
  })
  transactionDate: Date;

  @ApiProperty({
    description: 'Transaction creation date',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Transaction last update date',
  })
  updatedAt: Date;

  constructor(data: {
    id: string;
    type: TransactionType;
    ticker: string;
    quantity: number;
    price: number;
    transactionDate: Date;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = data.id;
    this.type = data.type;
    this.ticker = data.ticker;
    this.quantity = data.quantity;
    this.price = data.price;
    this.totalValue = data.quantity * data.price;
    this.transactionDate = data.transactionDate;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}

// Query filters for getting transactions
export const GetTransactionsQuerySchema = z.object({
  ticker: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  type: z.nativeEnum(TransactionType).optional(),
});

export class GetTransactionsQueryDto extends createZodDto(
  GetTransactionsQuerySchema,
) {}
