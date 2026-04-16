import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyImagesController } from './company-images.controller';
import { CompanyImagesService } from './company-images.service';
import { Company, CompanySchema } from './schemas/company.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Company.name, schema: CompanySchema }])],
  controllers: [CompaniesController, CompanyImagesController],
  providers: [CompaniesService, CompanyImagesService],
  exports: [CompaniesService, MongooseModule],
})
export class CompaniesModule {}
