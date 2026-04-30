import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsMongoId, IsOptional } from "class-validator";

export class QueryConsultationDto {
  @ApiPropertyOptional({ example: "507f1f77bcf86cd799439011" })
  @IsOptional()
  @IsMongoId()
  buyerId?: string;

  @ApiPropertyOptional({ example: "507f1f77bcf86cd799439012" })
  @IsOptional()
  @IsMongoId()
  sellerId?: string;
}
