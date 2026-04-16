import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';
import { MatchesService } from './matches.service';
import { FindMatchesDto } from './dto/find-matches.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';

class CompanyIdParam {
  @IsMongoId()
  companyId: string;
}

@ApiTags('Matches')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  @ApiOperation({ summary: '바이어 기반 기업 매칭' })
  @ApiResponse({
    status: 200,
    description: '스코어 순으로 정렬된 매칭 결과',
    schema: {
      example: {
        query: { buyerId: '6632a1f0e4b0a1c2d3e4f5a6', limit: 10 },
        count: 2,
        data: [
          { company: { _id: '...', name: '...' }, score: 8.5, reasons: ['tags overlap x2', 'industry match'] },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: '유효성 검사 실패 (buyerId 누락 또는 형식 오류)' })
  @ApiResponse({ status: 404, description: '바이어 없음' })
  findMatches(@Query() dto: FindMatchesDto) {
    return this.matchesService.findMatches(dto.buyerId, dto.limit ?? 10);
  }

  @Post(':companyId/feedback')
  @ApiOperation({ summary: '매칭 피드백 제출' })
  @ApiParam({ name: 'companyId', description: '기업 MongoDB ID (24자 hex)', example: '6632a1f0e4b0a1c2d3e4f5a6' })
  @ApiBody({ type: SubmitFeedbackDto })
  @ApiResponse({ status: 201, description: '피드백 저장 성공', schema: { example: { message: 'Feedback saved', id: '6632a1f0e4b0a1c2d3e4f5a6' } } })
  @ApiResponse({ status: 400, description: '유효성 검사 실패 (companyId 형식 오류 또는 rating 범위 초과)' })
  @ApiResponse({ status: 404, description: '기업 없음' })
  submitFeedback(
    @Param() params: CompanyIdParam,
    @Body() dto: SubmitFeedbackDto,
  ) {
    return this.matchesService.submitFeedback(params.companyId, dto);
  }
}
