import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsMongoId, IsOptional, IsInt, Min, Max } from 'class-validator';

export class FindMatchesDto {
  @ApiProperty({ description: '바이어 MongoDB ID (24자 hex)', example: '6632a1f0e4b0a1c2d3e4f5a6' })
  @IsMongoId()
  buyerId: string;

  @ApiPropertyOptional({ description: '결과 수 (기본 10)', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
