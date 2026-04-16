import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateIf } from 'class-validator';

function trimDedupe(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set((value as string[]).map((s) => String(s).trim()).filter(Boolean))];
}

export class CreateCompanyDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'Automotive' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @ApiPropertyOptional({ type: [String], example: ['EV parts', 'PCB'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => trimDedupe(value))
  offerings?: string[];

  @ApiPropertyOptional({ type: [String], example: ['OEM', 'overseas partner'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => trimDedupe(value))
  needs?: string[];

  @ApiPropertyOptional({ type: [String], example: ['B2B', 'export'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => trimDedupe(value))
  tags?: string[];

  @ApiPropertyOptional({ example: '한국 자동차 부품 제조사입니다.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  profileText?: string;

  @ApiPropertyOptional({ example: 'https://youtube.com/watch?v=xxx' })
  @IsOptional()
  @ValidateIf((o) => o.videoUrl !== '' && o.videoUrl != null)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  videoUrl?: string;
}
