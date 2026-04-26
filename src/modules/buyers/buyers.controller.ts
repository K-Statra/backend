import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { BuyersService } from "./buyers.service";
import { CreateBuyerDto } from "./dto/create-buyer.dto";
import { UpdateBuyerDto } from "./dto/update-buyer.dto";
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

  @Post()
  @ApiOperation({ summary: "바이어 생성" })
  @ApiResponse({ status: 201, description: "생성된 바이어" })
  @ApiResponse({ status: 400, description: "유효성 검사 실패" })
  create(@Body() dto: CreateBuyerDto) {
    return this.buyersService.create(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "바이어 수정 (부분 업데이트)" })
  @ApiParam({ name: "id", description: "MongoDB ObjectId" })
  @ApiResponse({ status: 200, description: "수정된 바이어" })
  @ApiResponse({ status: 400, description: "유효하지 않은 ID 또는 빈 본문" })
  @ApiResponse({ status: 404, description: "바이어 없음" })
  update(
    @Param("id", ParseMongoIdPipe) id: string,
    @Body() dto: UpdateBuyerDto,
  ) {
    return this.buyersService.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "바이어 삭제" })
  @ApiParam({ name: "id", description: "MongoDB ObjectId" })
  @ApiResponse({ status: 204, description: "삭제 성공" })
  @ApiResponse({ status: 400, description: "유효하지 않은 ID" })
  @ApiResponse({ status: 404, description: "바이어 없음" })
  remove(@Param("id", ParseMongoIdPipe) id: string) {
    return this.buyersService.remove(id);
  }
}
