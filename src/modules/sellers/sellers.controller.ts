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
import { SellersService } from "./sellers.service";
import { CreateSellerDto } from "./dto/create-seller.dto";
import { UpdateSellerDto } from "./dto/update-seller.dto";
import { QuerySellerDto } from "./dto/query-seller.dto";
import { ParseMongoIdPipe } from "../../common/pipes/parse-mongo-id.pipe";

@ApiTags("Sellers")
@Controller("sellers")
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Get()
  @ApiOperation({ summary: "기업 목록 (검색/페이지네이션/정렬)" })
  @ApiResponse({
    status: 200,
    description: "기업 목록",
    schema: {
      example: { page: 1, limit: 10, total: 100, totalPages: 10, data: [] },
    },
  })
  findAll(@Query() query: QuerySellerDto) {
    return this.sellersService.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "기업 단건 조회" })
  @ApiParam({ name: "id", description: "MongoDB ObjectId" })
  @ApiResponse({ status: 200, description: "기업 정보" })
  @ApiResponse({ status: 400, description: "유효하지 않은 ID" })
  @ApiResponse({ status: 404, description: "기업 없음" })
  findOne(@Param("id", ParseMongoIdPipe) id: string) {
    return this.sellersService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: "기업 생성 (이미지 없으면 플레이스홀더 자동 삽입)" })
  @ApiResponse({ status: 201, description: "생성된 기업" })
  @ApiResponse({ status: 400, description: "유효성 검사 실패" })
  create(@Body() dto: CreateSellerDto) {
    return this.sellersService.create(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "기업 수정 (부분 업데이트)" })
  @ApiParam({ name: "id", description: "MongoDB ObjectId" })
  @ApiResponse({ status: 200, description: "수정된 기업" })
  @ApiResponse({ status: 400, description: "유효하지 않은 ID 또는 빈 본문" })
  @ApiResponse({ status: 404, description: "기업 없음" })
  update(
    @Param("id", ParseMongoIdPipe) id: string,
    @Body() dto: UpdateSellerDto,
  ) {
    return this.sellersService.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "기업 삭제" })
  @ApiParam({ name: "id", description: "MongoDB ObjectId" })
  @ApiResponse({ status: 204, description: "삭제 성공" })
  @ApiResponse({ status: 400, description: "유효하지 않은 ID" })
  @ApiResponse({ status: 404, description: "기업 없음" })
  remove(@Param("id", ParseMongoIdPipe) id: string) {
    return this.sellersService.remove(id);
  }
}
