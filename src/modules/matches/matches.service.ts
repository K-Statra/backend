import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Seller, SellerDocument } from "../sellers/schemas/seller.schema";
import { Buyer, BuyerDocument } from "../buyers/schemas/buyer.schema";
import { MatchLog, MatchLogDocument } from "./schemas/match-log.schema";
import {
  MatchFeedback,
  MatchFeedbackDocument,
} from "./schemas/match-feedback.schema";

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

function scoreSeller(
  buyer: BuyerDocument,
  seller: any,
): { score: number; reasons: string[] } {
  const buyerIndustries = new Set(
    [buyer.industry_kr, buyer.industry_en]
      .filter(Boolean)
      .map((s) => s.toLowerCase().trim()),
  );
  const sellerTags = toSet(seller.tags);
  const sellerIndustry = String(seller.industry || "")
    .toLowerCase()
    .trim();

  let score = 0;
  const reasons: string[] = [];

  if (sellerIndustry && buyerIndustries.has(sellerIndustry)) {
    score += 3;
    reasons.push("industry match");
  }

  // Tags overlap with buyer industries as a fallback since buyer tags are removed
  const tagIndustryMatches = intersectCount(buyerIndustries, sellerTags);
  if (tagIndustryMatches > 0) {
    score += tagIndustryMatches * 2;
    reasons.push(`industry-tag overlap x${tagIndustryMatches}`);
  }

  const days = Math.max(
    0,
    (Date.now() - new Date(seller.updatedAt || Date.now()).getTime()) /
      86400000,
  );
  const recency = Math.max(0, 30 - days) / 30;
  if (recency > 0) {
    score += recency;
    reasons.push("recently updated");
  }

  const autoRegex = /자동차|부품|Automotive|Car parts|EV|Machinery|parts/i;
  if (
    autoRegex.test(sellerIndustry) ||
    Array.from(sellerTags).some((t) => autoRegex.test(t))
  ) {
    score += 2.0;
    reasons.push("Automotive sector priority");
  }

  const useEmbedding = process.env.MATCH_USE_EMBEDDING === "true";
  if (useEmbedding) {
    const weight = Number(process.env.MATCH_EMBEDDING_WEIGHT || 0.3);
    const sim =
      typeof seller.vectorScore === "number"
        ? seller.vectorScore
        : cosineSimilarity(buyer.embedding, seller.embedding);
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
    @InjectModel(Seller.name)
    private readonly sellerModel: Model<SellerDocument>,
    @InjectModel(Buyer.name) private readonly buyerModel: Model<BuyerDocument>,
    @InjectModel(MatchLog.name)
    private readonly matchLogModel: Model<MatchLogDocument>,
    @InjectModel(MatchFeedback.name)
    private readonly feedbackModel: Model<MatchFeedbackDocument>,
  ) {}

  async findMatches(buyerId: string, limit = 10) {
    const buyer = await this.buyerModel.findById(buyerId).exec();
    if (!buyer) throw new NotFoundException("Buyer not found");

    let candidates: any[];
    const useAtlasVector = process.env.MATCH_USE_ATLAS_VECTOR === "true";

    if (useAtlasVector && buyer.embedding?.length) {
      try {
        candidates = await this.sellerModel.aggregate([
          {
            $vectorSearch: {
              index: process.env.ATLAS_VECTOR_INDEX || "vector_index",
              path: "embedding",
              queryVector: buyer.embedding,
              numCandidates: 100,
              limit: 50,
            },
          },
          { $addFields: { vectorScore: { $meta: "vectorSearchScore" } } },
        ]);
      } catch (err) {
        this.logger.warn("Vector search failed, falling back", err);
        candidates = await this.sellerModel
          .find({})
          .sort({ updatedAt: -1 })
          .limit(200)
          .lean();
      }
    } else {
      candidates = await this.sellerModel
        .find({})
        .sort({ updatedAt: -1 })
        .limit(200)
        .lean();
    }

    const scored = candidates
      .map((c) => ({ seller: c, ...scoreSeller(buyer, c) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    try {
      await this.matchLogModel.create({
        buyerId: buyer._id,
        params: { limit },
        results: scored.map((r) => ({
          sellerId: r.seller._id,
          score: r.score,
          reasons: r.reasons.slice(0, 5),
        })),
      });
    } catch (err) {
      this.logger.warn("Failed to save match log", err);
    }

    return { query: { buyerId, limit }, count: scored.length, data: scored };
  }

  async submitFeedback(
    sellerId: string,
    dto: {
      rating: number;
      comments?: string;
      locale?: string;
      source?: string;
    },
  ) {
    const seller = await this.sellerModel.findById(sellerId).exec();
    if (!seller) throw new NotFoundException("Seller not found");
    const doc = await this.feedbackModel.create({
      sellerId: seller._id,
      rating: dto.rating,
      comments: dto.comments || "",
      locale: dto.locale || "",
      source: dto.source || "partner-search",
    });
    return { message: "Feedback saved", id: doc._id };
  }
}
