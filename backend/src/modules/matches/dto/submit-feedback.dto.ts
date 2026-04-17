import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SubmitFeedbackDto {
  @ApiProperty({
    description: '평점 (1~5)',
    minimum: 1,
    maximum: 5,
    example: 4,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({
    description: '코멘트 (최대 2000자)',
    example: '좋은 파트너입니다.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comments?: string;

  @ApiPropertyOptional({ description: '언어 코드', example: 'ko' })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  locale?: string;

  @ApiPropertyOptional({
    description: '피드백 출처',
    example: 'partner-search',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  source?: string;
}
