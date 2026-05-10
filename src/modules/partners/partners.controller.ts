import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { PartnersService } from "./partners.service";
import {
  OptionalCurrentUser,
  type SessionUser,
} from "../../common/decorators/current-user.decorator";

@ApiTags("Partners")
@Controller("partners")
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get("search")
  @ApiOperation({
    summary: "파트너 검색 (벡터 → 텍스트 폴백 → 웹검색 + LLM 인텐트)",
  })
  @ApiQuery({
    name: "q",
    required: true,
    description: "자연어 검색어 (한국어/영어)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "결과 수 (기본 10)",
  })
  @ApiQuery({ name: "industry", required: false, description: "산업 필터" })
  @ApiQuery({ name: "country", required: false, description: "국가 필터" })
  @ApiQuery({
    name: "partnership",
    required: false,
    description: "파트너십 태그 필터",
  })
  @ApiQuery({
    name: "size",
    required: false,
    description: "기업 규모 (예: 1-10, 11-50, 51-200)",
  })
  @ApiQuery({
    name: "buyerId",
    required: false,
    description: "바이어 ID (Neo4j 그래프 재랭킹용)",
  })
  @ApiResponse({
    status: 200,
    description: "검색 결과",
    schema: {
      example: { data: [], aiResponse: "", provider: "db", debug: {} },
    },
  })
  search(
    @OptionalCurrentUser() user: SessionUser | null,
    @Query("q") q: string,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit?: number,
    @Query("industry") industry?: string,
    @Query("country") country?: string,
    @Query("partnership") partnership?: string,
    @Query("size") size?: string,
    @Query("buyerId") buyerId?: string,
  ) {
    return this.partnersService.search({
      q,
      limit,
      industry,
      country,
      partnership,
      size,
      buyerId,
      userId: user?.userId,
    });
  }
}
