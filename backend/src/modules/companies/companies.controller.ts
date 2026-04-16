import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { QueryCompanyDto } from './dto/query-company.dto';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe';

@ApiTags('Companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @ApiOperation({ summary: '기업 목록 (검색/페이지네이션/정렬)' })
  @ApiResponse({ status: 200, description: '기업 목록', schema: { example: { page: 1, limit: 10, total: 100, totalPages: 10, data: [] } } })
  findAll(@Query() query: QueryCompanyDto) {
    return this.companiesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '기업 단건 조회' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: '기업 정보' })
  @ApiResponse({ status: 400, description: '유효하지 않은 ID' })
  @ApiResponse({ status: 404, description: '기업 없음' })
  findOne(@Param('id', ParseMongoIdPipe) id: string) {
    return this.companiesService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: '기업 생성 (이미지 없으면 플레이스홀더 자동 삽입)' })
  @ApiResponse({ status: 201, description: '생성된 기업' })
  @ApiResponse({ status: 400, description: '유효성 검사 실패' })
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '기업 수정 (부분 업데이트)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: '수정된 기업' })
  @ApiResponse({ status: 400, description: '유효하지 않은 ID 또는 빈 본문' })
  @ApiResponse({ status: 404, description: '기업 없음' })
  update(@Param('id', ParseMongoIdPipe) id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: '기업 삭제' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiResponse({ status: 204, description: '삭제 성공' })
  @ApiResponse({ status: 400, description: '유효하지 않은 ID' })
  @ApiResponse({ status: 404, description: '기업 없음' })
  remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.companiesService.remove(id);
  }
}
