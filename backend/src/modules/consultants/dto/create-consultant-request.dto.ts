import {
  IsString,
  IsEmail,
  IsOptional,
  MaxLength,
  MinLength,
  IsObject,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateConsultantRequestDto {
  @ApiProperty({ example: '홍길동' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(({ value }: { value: string }) => value?.trim())
  name: string;

  @ApiProperty({ example: 'hong@example.com' })
  @IsEmail()
  @MaxLength(200)
  @Transform(({ value }: { value: string }) => value?.trim())
  email: string;

  @ApiPropertyOptional({ example: '자동차 부품 수출 관련 상담을 원합니다.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  details?: string;

  @ApiPropertyOptional({
    example: 'matching-assistant',
    default: 'matching-assistant',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }: { value: string }) => value?.trim())
  serviceType?: string = 'matching-assistant';

  @ApiPropertyOptional({ example: 'ko' })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  locale?: string;

  @ApiPropertyOptional({ example: 'partner-search', default: 'partner-search' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  source?: string = 'partner-search';

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  buyerId?: string;

  @ApiPropertyOptional({ example: 'Acme Corp' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  buyerName?: string;

  @ApiPropertyOptional({ example: 'EV battery parts' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  searchTerm?: string;

  @ApiPropertyOptional({ example: { industry: 'Automotive', country: 'US' } })
  @IsOptional()
  @IsObject()
  filters?: Record<string, any> = {};
}
