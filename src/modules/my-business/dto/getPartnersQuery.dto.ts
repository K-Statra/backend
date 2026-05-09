// get-partners.query.dto.ts
import { IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class GetPartnersQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;
}
