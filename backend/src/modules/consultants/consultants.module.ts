import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConsultantsController } from './consultants.controller';
import { ConsultantsService } from './consultants.service';
import {
  ConsultantRequest,
  ConsultantRequestSchema,
} from './schemas/consultant-request.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConsultantRequest.name, schema: ConsultantRequestSchema },
    ]),
  ],
  controllers: [ConsultantsController],
  providers: [ConsultantsService],
})
export class ConsultantsModule {}
