import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConsultantsService } from './consultants.service';
import { CreateConsultantRequestDto } from './dto/create-consultant-request.dto';

@ApiTags('Consultants')
@Controller('consultants')
export class ConsultantsController {
  constructor(private readonly consultantsService: ConsultantsService) {}

  @Post('requests')
  @HttpCode(201)
  @ApiOperation({ summary: '컨설턴트 상담 요청 접수' })
  @ApiResponse({ status: 201, description: '요청 접수 완료', schema: { example: { id: '507f1f77bcf86cd799439011', status: 'NEW', message: 'Request received' } } })
  @ApiResponse({ status: 400, description: '유효성 검사 실패 (필수 필드 누락, 이메일 형식 오류 등)' })
  createRequest(@Body() dto: CreateConsultantRequestDto) {
    return this.consultantsService.createRequest(dto);
  }
}
