import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { SellersService } from "./sellers.service";
import { QuerySellerDto } from "./dto/query-seller.dto";

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
}
