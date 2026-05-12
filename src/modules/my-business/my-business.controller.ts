import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { MyBusinessService } from "./my-business.service";
import { SessionGuard } from "../../common/guards/session.guard";
import {
  CurrentUser,
  type SessionUser,
} from "../../common/decorators/current-user.decorator";
import { GetPartnersQueryDto } from "./dto/getPartnersQuery.dto";
import { SavePartnerDto } from "./dto/save-partner.dto";

@ApiTags("My Business")
@ApiCookieAuth("sessionId")
@Controller("my-business")
@UseGuards(SessionGuard)
export class MyBusinessController {
  constructor(private readonly myBusinessService: MyBusinessService) {}

  @Get("profile")
  @ApiOperation({ summary: "내 프로필 조회 (개인정보, 지갑 주소)" })
  @ApiResponse({ status: 200, description: "프로필 반환 성공" })
  @ApiResponse({ status: 401, description: "인증되지 않은 사용자" })
  getProfile(@CurrentUser() user: SessionUser) {
    return this.myBusinessService.getProfile(user.userId);
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
    @CurrentUser() user: SessionUser,
    @Query() query: GetPartnersQueryDto,
  ) {
    const { page, limit } = query;
    return this.myBusinessService.getPartners(user.userId, page, limit);
  }

  @Post("partners")
  @ApiOperation({ summary: "파트너 저장" })
  @ApiResponse({ status: 201, description: "파트너 저장 성공" })
  @ApiResponse({ status: 409, description: "이미 저장된 파트너" })
  @ApiResponse({ status: 404, description: "파트너를 찾을 수 없음" })
  savePartner(@CurrentUser() user: SessionUser, @Body() dto: SavePartnerDto) {
    return this.myBusinessService.savePartner(
      user.userId,
      dto.partnerId,
      dto.partnerType,
    );
  }

  @Delete("partners/:partnerId")
  @ApiOperation({ summary: "저장된 파트너 삭제" })
  @ApiResponse({ status: 200, description: "파트너 삭제 성공" })
  @ApiResponse({ status: 404, description: "저장된 파트너를 찾을 수 없음" })
  removePartner(
    @CurrentUser() user: SessionUser,
    @Param("partnerId") partnerId: string,
  ) {
    return this.myBusinessService.removePartner(user.userId, partnerId);
  }
}
