import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { MyBusinessService } from "./my-business.service";
import { SessionGuard } from "../../common/guards/session.guard";

@ApiTags("My Business")
@Controller("my-business")
@UseGuards(SessionGuard)
export class MyBusinessController {
  constructor(private readonly myBusinessService: MyBusinessService) {}

  @Get("profile")
  @ApiOperation({ summary: "내 프로필 조회 (개인정보, 지갑 주소)" })
  @ApiResponse({ status: 200, description: "프로필 반환 성공" })
  @ApiResponse({ status: 401, description: "인증되지 않은 사용자" })
  getProfile(@Req() req: any) {
    return this.myBusinessService.getProfile(req.session.userId);
  }
}
