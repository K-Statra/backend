import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
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

  @Get("partners")
  @ApiOperation({ summary: "내 파트너 기업 목록 조회" })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "페이지 번호 (기본 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "페이지당 항목 수 (기본 10)",
  })
  @ApiResponse({
    status: 200,
    description: "파트너 기업 목록",
    schema: {
      example: { page: 1, limit: 10, total: 30, totalPages: 3, data: [] },
    },
  })
  @ApiResponse({ status: 401, description: "인증되지 않은 사용자" })
  getPartners(
    @Req() req: any,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.myBusinessService.getPartners(req.session.userId, page, limit);
  }
}
