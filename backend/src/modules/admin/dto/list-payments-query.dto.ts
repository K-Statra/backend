import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsIn, IsMongoId, IsDateString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListPaymentsQueryDto {
  @ApiPropertyOptional({ enum: ['CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED'] })
  @IsOptional()
  @IsIn(['CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED'])
  status?: string;

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsMongoId()
  buyerId?: string;

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439012' })
  @IsOptional()
  @IsMongoId()
  companyId?: string;

  @ApiPropertyOptional({ example: '2024-01-01', description: 'ISO 8601 날짜' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2024-12-31', description: 'ISO 8601 날짜' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
