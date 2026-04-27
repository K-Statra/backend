import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { BuyersService } from "./buyers.service";
import { QueryBuyerDto } from "./dto/query-buyer.dto";
import { ParseMongoIdPipe } from "../../common/pipes/parse-mongo-id.pipe";

@ApiTags("Buyers")
@Controller("buyers")
export class BuyersController {
  constructor(private readonly buyersService: BuyersService) {}

  @Get()
  @ApiOperation({ summary: "바이어 목록 (페이징 + 필터)" })
  @ApiResponse({
    status: 200,
    description: "바이어 목록",
    schema: {
      example: { page: 1, limit: 10, total: 50, totalPages: 5, data: [] },
    },
  })
  findAll(@Query() query: QueryBuyerDto) {
    return this.buyersService.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "바이어 단건 조회" })
  @ApiParam({ name: "id", description: "MongoDB ObjectId" })
  @ApiResponse({ status: 200, description: "바이어 정보" })
  @ApiResponse({ status: 400, description: "유효하지 않은 ID" })
  @ApiResponse({ status: 404, description: "바이어 없음" })
  findOne(@Param("id", ParseMongoIdPipe) id: string) {
    return this.buyersService.findById(id);
  }
}
