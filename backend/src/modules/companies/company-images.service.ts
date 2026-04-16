import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Company, CompanyDocument } from './schemas/company.schema';

@Injectable()
export class CompanyImagesService {
  constructor(
    @InjectModel(Company.name) private readonly companyModel: Model<CompanyDocument>,
  ) {}

  async getImages(companyId: string) {
    const company = await this.companyModel.findById(companyId).select('images').exec();
    if (!company) throw new NotFoundException('Company not found');
    return company.images;
  }

  async addImage(
    companyId: string,
    data: { url: string; caption?: string; alt?: string; tags?: string[] },
  ) {
    const company = await this.companyModel.findById(companyId).exec();
    if (!company) throw new NotFoundException('Company not found');

    company.images.push({
      url: data.url,
      caption: data.caption || '',
      alt: data.alt || company.name,
      tags: data.tags || [],
      clipEmbedding: [],
    });
    await company.save();
    return company.images[company.images.length - 1];
  }

  async removeImage(companyId: string, imageId: string): Promise<void> {
    const company = await this.companyModel.findById(companyId).exec();
    if (!company) throw new NotFoundException('Company not found');

    const initialLen = company.images.length;
    company.images = company.images.filter(
      (img) => (img as any)._id?.toString() !== imageId,
    ) as typeof company.images;

    if (company.images.length === initialLen) throw new NotFoundException('Image not found');
    await company.save();
  }
}
