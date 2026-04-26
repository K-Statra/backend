import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ConsultationsService } from "./consultations.service";
import { CreateConsultationDto } from "./dto/create-consultation.dto";
import { QueryConsultationDto } from "./dto/query-consultation.dto";
import { UpdateConsultationStatusDto } from "./dto/update-consultation-status.dto";
import { ParseMongoIdPipe } from "../../common/pipes/parse-mongo-id.pipe";

@ApiTags("Consultations")
@Controller("consultations")
export class ConsultationsController {
  constructor(private readonly consultationsService: ConsultationsService) {}

  @Post()
  @ApiOperation({ summary: "미팅 예약 생성" })
  create(@Body() dto: CreateConsultationDto) {
    return this.consultationsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "미팅 예약 목록 조회 (buyerId / companyId 필터)" })
  findAll(@Query() query: QueryConsultationDto) {
    return this.consultationsService.findAll(query);
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "미팅 예약 상태 변경" })
  updateStatus(
    @Param("id", ParseMongoIdPipe) id: string,
    @Body() dto: UpdateConsultationStatusDto,
  ) {
    return this.consultationsService.updateStatus(id, dto);
  }
}
