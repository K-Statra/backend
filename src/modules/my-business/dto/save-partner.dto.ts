import { IsIn, IsMongoId } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SavePartnerDto {
  @ApiProperty({ description: "저장할 파트너 ID" })
  @IsMongoId()
  partnerId: string;

  @ApiProperty({ enum: ["seller", "buyer"], description: "파트너 타입" })
  @IsIn(["seller", "buyer"])
  partnerType: "seller" | "buyer";
}
