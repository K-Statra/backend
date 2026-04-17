import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

function trimDedupe(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      (value as string[]).map((s) => String(s).trim()).filter(Boolean),
    ),
  ];
}

export class CreateBuyerDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'US' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['Automotive', 'Electronics'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => trimDedupe(value))
  industries?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['OEM parts', 'EV components'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => trimDedupe(value))
  needs?: string[];

  @ApiPropertyOptional({ type: [String], example: ['B2B', 'import'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => trimDedupe(value))
  tags?: string[];

  @ApiPropertyOptional({ example: '미국 자동차 부품 바이어입니다.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  profileText?: string;
}
