import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Company, CompanyDocument } from '../companies/schemas/company.schema';
import { Buyer, BuyerDocument } from '../buyers/schemas/buyer.schema';
import { MatchLog, MatchLogDocument } from './schemas/match-log.schema';
import {
  MatchFeedback,
  MatchFeedbackDocument,
} from './schemas/match-feedback.schema';

function toSet(arr: string[]): Set<string> {
  return new Set(
    (arr || []).map((s) => s.toLowerCase().trim()).filter(Boolean),
  );
}

function intersectCount(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const x of a) if (b.has(x)) count++;
  return count;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length) return 0;
  const n = Math.min(a.length, b.length);
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return Math.max(0, Math.min(1, dot / (Math.sqrt(na) * Math.sqrt(nb))));
}

function scoreCompany(
  buyer: BuyerDocument,
  company: any,
): { score: number; reasons: string[] } {
  const buyerTags = toSet(buyer.tags);
  const buyerIndustries = toSet(buyer.industries);
  const buyerNeeds = toSet(buyer.needs);
  const companyTags = toSet(company.tags);
  const companyIndustry = String(company.industry || '')
    .toLowerCase()
    .trim();
  const companyOfferings = toSet(company.offerings);

  let score = 0;
  const reasons: string[] = [];

  const tagMatches = intersectCount(buyerTags, companyTags);
  if (tagMatches > 0) {
    score += tagMatches * 2;
    reasons.push(`tags overlap x${tagMatches}`);
  }

  if (companyIndustry && buyerIndustries.has(companyIndustry)) {
    score += 3;
    reasons.push('industry match');
  }

  const needMatches = intersectCount(buyerNeeds, companyOfferings);
  if (needMatches > 0) {
    score += needMatches * 2;
    reasons.push(`needs-offerings overlap x${needMatches}`);
  }

  const days = Math.max(
    0,
    (Date.now() - new Date(company.updatedAt || Date.now()).getTime()) /
      86400000,
  );
  const recency = Math.max(0, 30 - days) / 30;
  if (recency > 0) {
    score += recency;
    reasons.push('recently updated');
  }

  const autoRegex = /자동차|부품|Automotive|Car parts|EV|Machinery|parts/i;
  if (
    autoRegex.test(companyIndustry) ||
    Array.from(companyTags).some((t) => autoRegex.test(t))
  ) {
    score += 2.0;
    reasons.push('Automotive sector priority');
  }

  if (company.dart?.corpCode) {
    score += 1.5;
    reasons.push('DART verified');
  }

  const useEmbedding = process.env.MATCH_USE_EMBEDDING === 'true';
  if (useEmbedding) {
    const weight = Number(process.env.MATCH_EMBEDDING_WEIGHT || 0.3);
    const sim =
      typeof company.vectorScore === 'number'
        ? company.vectorScore
        : cosineSimilarity(buyer.embedding, company.embedding);
    if (sim > 0 && weight > 0) {
      score += sim * 10 * Math.min(1, weight);
      reasons.push(`embedding sim ${sim.toFixed(2)}`);
    }
  }

  return { score, reasons };
}

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(Buyer.name) private readonly buyerModel: Model<BuyerDocument>,
    @InjectModel(MatchLog.name)
    private readonly matchLogModel: Model<MatchLogDocument>,
    @InjectModel(MatchFeedback.name)
    private readonly feedbackModel: Model<MatchFeedbackDocument>,
  ) {}

  async findMatches(buyerId: string, limit = 10) {
    const buyer = await this.buyerModel.findById(buyerId).exec();
    if (!buyer) throw new NotFoundException('Buyer not found');

    let candidates: any[];
    const useAtlasVector = process.env.MATCH_USE_ATLAS_VECTOR === 'true';

    if (useAtlasVector && buyer.embedding?.length) {
      try {
        candidates = await this.companyModel.aggregate([
          {
            $vectorSearch: {
              index: process.env.ATLAS_VECTOR_INDEX || 'vector_index',
              path: 'embedding',
              queryVector: buyer.embedding,
              numCandidates: 100,
              limit: 50,
            },
          },
          { $addFields: { vectorScore: { $meta: 'vectorSearchScore' } } },
        ]);
      } catch (err) {
        this.logger.warn('Vector search failed, falling back', err);
        candidates = await this.companyModel
          .find({})
          .sort({ updatedAt: -1 })
          .limit(200)
          .lean();
      }
    } else {
      candidates = await this.companyModel
        .find({})
        .sort({ updatedAt: -1 })
        .limit(200)
        .lean();
    }

    const scored = candidates
      .map((c) => ({ company: c, ...scoreCompany(buyer, c) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    try {
      await this.matchLogModel.create({
        buyerId: buyer._id,
        params: { limit },
        results: scored.map((r) => ({
          companyId: r.company._id,
          score: r.score,
          reasons: r.reasons.slice(0, 5),
        })),
      });
    } catch (err) {
      this.logger.warn('Failed to save match log', err);
    }

    return { query: { buyerId, limit }, count: scored.length, data: scored };
  }

  async submitFeedback(
    companyId: string,
    dto: {
      rating: number;
      comments?: string;
      locale?: string;
      source?: string;
    },
  ) {
    const company = await this.companyModel.findById(companyId).exec();
    if (!company) throw new NotFoundException('Company not found');
    const doc = await this.feedbackModel.create({
      companyId: company._id,
      rating: dto.rating,
      comments: dto.comments || '',
      locale: dto.locale || '',
      source: dto.source || 'partner-search',
    });
    return { message: 'Feedback saved', id: doc._id };
  }
}
