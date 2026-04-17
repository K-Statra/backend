import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UploadImageDto {
  @ApiPropertyOptional({
    description: '이미지 URL (파일 업로드와 둘 중 하나 필수)',
  })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url?: string;

  @ApiPropertyOptional({ example: '전시회 부스 사진' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string;

  @ApiPropertyOptional({ example: 'Acme Corp 제품 이미지' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  alt?: string;

  // multipart/form-data에서 tags는 콤마 구분 문자열로 전달됨
  @ApiPropertyOptional({
    example: 'B2B,export',
    description: '콤마로 구분된 태그 문자열',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : Array.isArray(value)
        ? value
        : [],
  )
  tags?: string[];
}
