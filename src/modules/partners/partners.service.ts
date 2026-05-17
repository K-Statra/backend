import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import axios from "axios";
import { Seller, SellerDocument } from "../sellers/schemas/seller.schema";
import { Buyer, BuyerDocument } from "../buyers/schemas/buyer.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { EmbeddingsService } from "../embeddings/embeddings.service";

const INDUSTRY_MAPPING: Record<string, string[]> = {
  "Automotive / EV Parts": [
    "Mobility / Automation / Manufacturing",
    "Industrial & Manufacturing",
    "Mobility",
    "Automotive",
    "Car parts",
    "EV",
  ],
  "IT / AI / SaaS": ["IT / AI / SaaS", "Tech & Electronics", "Software"],
  "Healthcare / Bio / Medical": [
    "Healthcare / Bio / Medical",
    "Health & Bio",
    "Medical",
  ],
  "Green Energy / Climate Tech / Smart City": [
    "Green Energy / Climate Tech / Smart City",
    "Energy & Environment",
  ],
  "Mobility / Automation / Manufacturing": [
    "Mobility / Automation / Manufacturing",
    "Industrial & Manufacturing",
    "Mobility",
  ],
  "Beauty / Consumer Goods / Food": [
    "Beauty / Consumer Goods / Food",
    "Beauty & Cosmetics",
    "Food & Beverage",
    "Consumer Goods",
  ],
  "Content / Culture / Edutech": [
    "Content / Culture / Edutech",
    "Content",
    "Education",
  ],
  "Fintech / Smart Finance": ["Fintech / Smart Finance", "Finance"],
  Other: ["Other", "(Unspecified)"],
};

export interface SearchOptions {
  q: string;
  limit?: number;
  industry?: string;
  country?: string;
  partnership?: string;
  size?: string;
  buyerId?: string;
  userId?: string;
}

export interface SearchResult {
  data: any[];
  aiResponse: string;
  provider: string;
  debug: Record<string, any>;
}

const SEARCH_PROJECTION = {
  name: 1,
  nameEn: 1,
  industry: 1,
  tags: 1,
  location: 1,
  sizeBucket: 1,
  profileText: 1,
  address: 1,
  dart: 1,
  primaryContact: 1,
  activities: 1,
  products: 1,
  updatedAt: 1,
} as const;

// Buyer mapping to common format
const mapBuyerToCommon = (b: any) => ({
  _id: b._id,
  name: b.name_kr || b.name_en,
  nameEn: b.name_en,
  industry: b.industry_kr || b.industry_en,
  location: { country: b.country, city: "", state: "" },
  profileText: b.intro_kr || b.intro_en,
  websiteUrl: b.website,
  email: b.email,
  tags: ["Buyer"],
  score: b.score,
  updatedAt: b.updatedAt,
});

const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

@Injectable()
export class PartnersService {
  private readonly logger = new Logger(PartnersService.name);

  constructor(
    @InjectModel(Seller.name)
    private readonly sellerModel: Model<SellerDocument>,
    @InjectModel(Buyer.name)
    private readonly buyerModel: Model<BuyerDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  async search(opts: SearchOptions): Promise<SearchResult> {
    const startTime = performance.now();
    const {
      q,
      limit = 10,
      industry,
      country,
      partnership,
      size,
      buyerId,
    } = opts;

    let forceWebSearch = false;
    let tavilyQuery = q ?? "";
    let detectedIntent = "seller";
    let intentData: any = null;
    let aiResponse = "";

    this.logger.log(
      `[Search Start] query: "${q}", industry: ${industry}, country: ${country}`,
    );

    if (q) {
      const intentStartTime = performance.now();
      const qLower = q.toLowerCase();
      const hasRegion = REGION_KEYWORDS.some((kw) =>
        qLower.includes(kw.toLowerCase()),
      );
      const isKorea = KOREA_KEYWORDS.some((kw) =>
        qLower.includes(kw.toLowerCase()),
      );
      const hasBuyerIntent = BUYER_KEYWORDS.some((kw) =>
        qLower.includes(kw.toLowerCase()),
      );
      const hasSellerIntent = SELLER_KEYWORDS.some((kw) =>
        qLower.includes(kw.toLowerCase()),
      );
      const isAutomotive = AUTOMOTIVE_KEYWORDS.some((kw) =>
        qLower.includes(kw.toLowerCase()),
      );

      if (hasBuyerIntent) detectedIntent = "buyer";
      else if (hasSellerIntent) detectedIntent = "seller";

      let skipLLM = false;
      if (hasRegion && isAutomotive && (hasBuyerIntent || hasSellerIntent)) {
        tavilyQuery = buildTavilyQuery(q, detectedIntent);
        skipLLM = true;
      }

      if (!skipLLM && hasRegion && (hasBuyerIntent || hasSellerIntent)) {
        forceWebSearch = true;
        try {
          const intentPromise = this.extractSearchIntent(q);
          const timeoutPromise = new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("LLM Timeout")), 4000),
          );
          intentData = await Promise.race([intentPromise, timeoutPromise]);
          tavilyQuery =
            intentData?.webQuery ?? buildTavilyQuery(q, detectedIntent);
          if (intentData?.role === "Buyer") detectedIntent = "buyer";
          else if (intentData?.role === "Seller") detectedIntent = "seller";
        } catch {
          tavilyQuery = buildTavilyQuery(q, detectedIntent);
        }
      } else if (isKorea && !hasRegion) {
        forceWebSearch = false;
      } else if (!hasRegion && !hasBuyerIntent && !hasSellerIntent) {
        forceWebSearch = false;
      } else if (skipLLM || hasRegion) {
        forceWebSearch = true;
      }

      this.logger.log(
        `[Step 1: Intent Analysis] took ${Math.round(performance.now() - intentStartTime)}ms. detectedIntent: ${detectedIntent}, forceWebSearch: ${forceWebSearch}`,
      );
    }

    const activeModel: Model<any> =
      detectedIntent === "buyer" ? this.buyerModel : this.sellerModel;
    const isBuyerSearch = detectedIntent === "buyer";

    // Exclude already-saved partners for logged-in users
    const excludeObjectIds: Types.ObjectId[] = [];
    if (opts.userId) {
      const user = await this.userModel
        .findById(opts.userId, { savedPartners: 1 })
        .lean();
      if (user?.savedPartners?.length) {
        excludeObjectIds.push(...user.savedPartners.map((p) => p.partnerId));
      }
    }

    // --- 1. DB search (AI-Enhanced Parallel Hybrid) ---
    let vectorResults: any[] = [];
    let textResults: any[] = [];
    let vector: number[] = [];
    let hydeDocument: string | null = null;
    let aiKeywords: string | null = null;

    if (!forceWebSearch && q) {
      const aiStartTime = performance.now();

      // 1.0 AI Query Understanding (HyDE + Keywords)
      const aiAnalysis = await this.generateHyDEAndKeywords(q, detectedIntent);
      hydeDocument = aiAnalysis.profile;
      aiKeywords = filterGenericKeywords(aiAnalysis.keywords);

      this.logger.log(
        `[Step 2.AI Analysis] took ${Math.round(performance.now() - aiStartTime)}ms. Keywords: "${aiKeywords}"`,
      );

      // 텍스트 기반 검색
      const textSearchTask = (async () => {
        const textStartTime = performance.now();
        const filter: Record<string, any> = { $text: { $search: aiKeywords } };
        if (industry) {
          if (isBuyerSearch) {
            filter.$and = [
              { $text: { $search: aiKeywords } },
              {
                $or: [
                  {
                    industry_kr: {
                      $regex: escapeRegex(industry),
                      $options: "i",
                    },
                  },
                  {
                    industry_en: {
                      $regex: escapeRegex(industry),
                      $options: "i",
                    },
                  },
                ],
              },
            ];
          } else {
            filter.industry = INDUSTRY_MAPPING[industry]
              ? { $in: INDUSTRY_MAPPING[industry] }
              : industry;
          }
        }
        if (country) {
          if (isBuyerSearch) filter.country = country;
          else filter["location.country"] = country;
        }
        if (excludeObjectIds.length > 0)
          filter._id = { $nin: excludeObjectIds };

        const projection = isBuyerSearch
          ? {
              name_kr: 1,
              name_en: 1,
              industry_kr: 1,
              industry_en: 1,
              country: 1,
              intro_kr: 1,
              intro_en: 1,
              website: 1,
              email: 1,
              updatedAt: 1,
              score: { $meta: "textScore" },
            }
          : { ...SEARCH_PROJECTION, score: { $meta: "textScore" } };

        try {
          const raw = await activeModel
            .find(filter as any)
            .select(projection as any)
            .sort({ score: { $meta: "textScore" } } as any)
            .limit(100)
            .lean();
          textResults = raw.map((r: any) => {
            const common = isBuyerSearch ? mapBuyerToCommon(r) : r;
            return { ...common, textScore: r.score };
          });
          this.logger.log(
            `[Step 2.Text] Found ${textResults.length} items. took ${Math.round(performance.now() - textStartTime)}ms`,
          );
        } catch (err: any) {
          this.logger.error(`[Search] Text search error: ${err.message}`);
        }
      })();

      const vectorSearchTask = (async () => {
        // 2.1 Embedding
        const embedStartTime = performance.now();
        try {
          vector = await this.embeddingsService.embed(hydeDocument);
          this.logger.log(
            `[Step 2.Embed] took ${Math.round(performance.now() - embedStartTime)}ms`,
          );
        } catch {
          return;
        }

        // 2.2 Vector Search
        const indexName = isBuyerSearch
          ? process.env.ATLAS_BUYER_VECTOR_INDEX || "buyer_vector_index"
          : process.env.ATLAS_VECTOR_INDEX || "sellers_vector_index";

        const pipeline: any[] = [
          {
            $vectorSearch: {
              index: indexName,
              path: "embedding",
              queryVector: vector,
              numCandidates: 100,
              limit: 100,
            },
          },
        ];

        const matchStage: Record<string, any> = {};
        if (industry) {
          if (isBuyerSearch) {
            matchStage.$or = [
              { industry_kr: { $regex: industry, $options: "i" } },
              { industry_en: { $regex: industry, $options: "i" } },
            ];
          } else {
            matchStage.industry = INDUSTRY_MAPPING[industry]
              ? { $in: INDUSTRY_MAPPING[industry] }
              : industry;
          }
        }
        if (country) {
          if (isBuyerSearch) matchStage.country = country;
          else matchStage["location.country"] = country;
        }
        if (excludeObjectIds.length > 0)
          matchStage._id = { $nin: excludeObjectIds };
        if (Object.keys(matchStage).length > 0)
          pipeline.push({ $match: matchStage });

        if (isBuyerSearch) {
          pipeline.push({
            $project: {
              name_kr: 1,
              name_en: 1,
              industry_kr: 1,
              industry_en: 1,
              country: 1,
              intro_kr: 1,
              intro_en: 1,
              website: 1,
              email: 1,
              updatedAt: 1,
              score: { $meta: "vectorSearchScore" },
            },
          });
        } else {
          pipeline.push({
            $project: {
              ...SEARCH_PROJECTION,
              score: { $meta: "vectorSearchScore" },
            },
          });
        }

        try {
          const raw = await activeModel.aggregate(pipeline);
          vectorResults = isBuyerSearch ? raw.map(mapBuyerToCommon) : raw;
          this.logger.log(
            `[Step 2.Vector] Found ${vectorResults.length} items`,
          );
        } catch (err: any) {
          this.logger.error(`[Search] Vector search error: ${err.message}`);
        }
      })();

      await Promise.all([textSearchTask, vectorSearchTask]);
    }

    // 1.3 Merge Results (Reciprocal Rank Fusion)
    let dbResults: any[] = [];
    if (vectorResults.length > 0 || textResults.length > 0) {
      const K = 60;
      const GHOST_RANK = 500;

      const vectorRankMap = new Map(
        [...vectorResults]
          .sort((a, b) => b.score - a.score)
          .map((r, i) => [r._id.toString(), i + 1]),
      );
      const textRankMap = new Map(
        [...textResults]
          .sort((a, b) => b.textScore - a.textScore)
          .map((r, i) => [r._id.toString(), i + 1]),
      );

      const allIds = new Set([
        ...vectorResults.map((r) => r._id.toString()),
        ...textResults.map((r) => r._id.toString()),
      ]);

      const vectorDocMap = new Map<string, any>();
      vectorResults.forEach((r) => vectorDocMap.set(r._id.toString(), r));
      const textDocMap = new Map<string, any>();
      textResults.forEach((r) => textDocMap.set(r._id.toString(), r));

      dbResults = [...allIds]
        .map((id) => {
          const vRank = vectorRankMap.get(id) ?? GHOST_RANK;
          const tRank = textRankMap.get(id) ?? GHOST_RANK;
          const base = vectorDocMap.get(id) ?? textDocMap.get(id);
          return {
            ...base,
            vectorScore: vectorDocMap.get(id)?.score ?? 0,
            textScore: textDocMap.get(id)?.textScore ?? 0,
            score: 1 / (K + vRank) + 1 / (K + tRank),
            vectorRank: vRank,
            textRank: tRank,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, Number(limit));
    }

    // --- 1.8. Filter-only browsing ---
    if (
      !forceWebSearch &&
      !q &&
      (industry || country || (isBuyerSearch ? false : partnership || size))
    ) {
      const filter: Record<string, any> = {};
      if (industry) {
        if (isBuyerSearch) {
          filter.$or = [
            { industry_kr: { $regex: industry, $options: "i" } },
            { industry_en: { $regex: industry, $options: "i" } },
          ];
        } else {
          filter.industry = INDUSTRY_MAPPING[industry]
            ? { $in: INDUSTRY_MAPPING[industry] }
            : industry;
        }
      }
      if (country) {
        if (isBuyerSearch) filter.country = country;
        else filter["location.country"] = country;
      }
      if (!isBuyerSearch) {
        if (partnership) filter.tags = partnership;
        if (size) filter.sizeBucket = size;
      }
      if (excludeObjectIds.length > 0) filter._id = { $nin: excludeObjectIds };

      const projection = isBuyerSearch
        ? {
            name_kr: 1,
            name_en: 1,
            industry_kr: 1,
            industry_en: 1,
            country: 1,
            intro_kr: 1,
            intro_en: 1,
            website: 1,
            email: 1,
            updatedAt: 1,
          }
        : SEARCH_PROJECTION;

      const raw = await activeModel
        .find(filter as any, projection as any)
        .limit(Number(limit))
        .sort({ updatedAt: -1 } as any)
        .lean();
      dbResults = raw.map((r) => {
        const common = isBuyerSearch ? mapBuyerToCommon(r) : r;
        return { ...common, score: 1.0 };
      });
    }

    // --- 1.9. Default show-all ---
    if (!forceWebSearch && !q && dbResults.length === 0) {
      const projection = isBuyerSearch
        ? {
            name_kr: 1,
            name_en: 1,
            industry_kr: 1,
            industry_en: 1,
            country: 1,
            intro_kr: 1,
            intro_en: 1,
            website: 1,
            email: 1,
            updatedAt: 1,
          }
        : SEARCH_PROJECTION;

      const raw = await activeModel
        .find(
          excludeObjectIds.length > 0
            ? { _id: { $nin: excludeObjectIds } }
            : {},
          projection as any,
        )
        .limit(Number(limit))
        .lean();
      dbResults = raw.map((r) => {
        const common = isBuyerSearch ? mapBuyerToCommon(r) : r;
        return { ...common, score: 1.0 };
      });
    }

    // --- 2. Web search fallback ---
    const shouldFallbackToWeb = forceWebSearch || dbResults.length === 0;

    if (shouldFallbackToWeb && q) {
      const webStartTime = performance.now();
      let webResults: { results: any[]; answer?: string } = { results: [] };
      try {
        const tavilyPromise = this.searchWeb(tavilyQuery);
        const timeoutPromise = new Promise<typeof webResults>((_, reject) =>
          setTimeout(() => reject(new Error("Tavily Timeout")), 7000),
        );
        webResults = await Promise.race([tavilyPromise, timeoutPromise]);
      } catch (err: any) {
        this.logger.error(`[Search] Tavily error: ${err.message}`);
      }

      const rawResults = webResults.results || [];
      aiResponse =
        webResults.answer || "Here are the results found on the web.";
      const isAutomotive = AUTOMOTIVE_KEYWORDS.some((kw) =>
        (q ?? "").toLowerCase().includes(kw.toLowerCase()),
      );

      let mappedWebResults = rawResults.map((item: any, index: number) => {
        let score = item.score || 0.9;
        const title = (item.title || "").toLowerCase();
        const content = (item.content || "").toLowerCase();

        if (detectedIntent === "buyer") {
          const penalties = [
            "supplier",
            "seller",
            "manufacturer",
            "factory",
            "exporter",
            "producer",
            "industrial",
            "plant",
          ];
          const boosts = [
            "importer",
            "distributor",
            "buyer",
            "procurement",
            "purchasing",
            "trading",
          ];
          if (penalties.some((p) => title.includes(p))) score -= 0.4;
          if (penalties.some((p) => content.includes(p))) score -= 0.2;
          if (boosts.some((b) => title.includes(b))) score += 0.2;
          if (boosts.some((b) => content.includes(b))) score += 0.1;
          if (
            content.includes("manufacture of") ||
            content.includes("supply of") ||
            content.includes("products from")
          )
            score -= 0.2;
        } else if (detectedIntent === "seller") {
          if (
            title.includes("supplier") ||
            title.includes("exporter") ||
            title.includes("manufacturer")
          )
            score += 0.1;
          if (title.includes("importer only")) score -= 0.2;
        }

        if (isAutomotive) {
          const autoTerms = [
            "auto",
            "vehicle",
            "car",
            "part",
            "truck",
            "engine",
            "motor",
            "tire",
            "battery",
            "accessory",
            "mechanical",
            "spare",
          ];
          if (
            !autoTerms.some((t) =>
              (item.title + " " + item.content).toLowerCase().includes(t),
            )
          ) {
            score -= 0.6;
          }
        }

        return {
          _id: `web_${index}`,
          name: item.title,
          industry: "Web Result",
          location: { country: "Global", city: "", state: "" },
          profileText: item.content,
          websiteUrl: item.url,
          tags: ["Web"],
          score: Math.min(1.0, Math.max(0.1, score)),
        };
      });

      if (intentData?.country) {
        const countryLower = (intentData.country as string).toLowerCase();
        mappedWebResults = mappedWebResults.map((item: any) => {
          const text = (
            (item.sellerIntroduction || "") +
            " " +
            (item.name || "")
          ).toLowerCase();
          if (!text.includes(countryLower))
            return { ...item, score: item.score * 0.7 };
          return item;
        });
      }

      mappedWebResults.sort((a: any, b: any) => b.score - a.score);
      this.logger.log(
        `[Step 2: Web Search] found ${mappedWebResults.length} items. took ${Math.round(performance.now() - webStartTime)}ms`,
      );

      const totalDuration = Math.round(performance.now() - startTime);
      this.logger.log(
        `[Search Complete] provider: tavily, count: ${mappedWebResults.length}, totalTime: ${totalDuration}ms`,
      );

      return {
        data: mappedWebResults,
        aiResponse,
        provider: "tavily",
        debug: {
          searchType: "WEB",
          count: mappedWebResults.length,
          intent: detectedIntent,
          forceWebSearch: true,
          tavilyQuery,
          hydeDocument,
          duration: `${totalDuration}ms`,
        },
      };
    }

    // --- 3. Neo4j graph re-ranking (optional) ---
    let hybridResults = dbResults;
    if (process.env.NEO4J_URI && dbResults.length > 0 && buyerId) {
      const graphStartTime = performance.now();
      try {
        const graphScores = await this.getGraphScores(
          buyerId,
          dbResults.map((r) => r._id.toString()),
        );
        const weight = Number(process.env.GRAPH_SCORE_WEIGHT || 0.3);
        hybridResults = dbResults
          .map((r) => {
            const gScore = graphScores[r._id.toString()] || 0;
            const vScore = r.score || 0;
            const normGraph = Math.min(1.0, gScore / 6.0);
            return {
              ...r,
              graphScore: gScore,
              vectorScore: vScore,
              score: vScore * (1 - weight) + normGraph * weight,
            };
          })
          .sort((a, b) => b.score - a.score);
        this.logger.log(
          `[Step 3: Graph Re-ranking] took ${Math.round(performance.now() - graphStartTime)}ms`,
        );
      } catch (err: any) {
        this.logger.error(`[Search] Graph scoring error: ${err.message}`);
      }
    }

    const searchType =
      hybridResults.length === 0
        ? "EMPTY"
        : vector.length > 0
          ? "VECTOR"
          : "BROWSE";

    const totalDuration = Math.round(performance.now() - startTime);
    this.logger.log(
      `[Search Complete] provider: db, type: ${searchType}, count: ${hybridResults.length}, totalTime: ${totalDuration}ms`,
    );

    return {
      data: hybridResults,
      aiResponse,
      provider: "db",
      debug: {
        searchType,
        count: hybridResults.length,
        graphUsed: !!(process.env.NEO4J_URI && buyerId),
        intent: detectedIntent,
        forceWebSearch,
        tavilyQuery: tavilyQuery || null,
        hydeDocument,
        aiKeywords,
        duration: `${totalDuration}ms`,
      },
    };
  }

  private async generateHyDEAndKeywords(
    query: string,
    intent: string,
  ): Promise<{ profile: string; keywords: string }> {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.GPT_MODEL_ID || "gpt-4o";
    if (!apiKey) return { profile: query, keywords: query };

    try {
      const roleText =
        intent === "buyer" ? "buyer/importer" : "seller/supplier";
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model,
          messages: [
            {
              role: "system",
              content: `You are a B2B matching expert. Analyze the query and provide:
1. "profile": A 1-2 sentence "ideal" company profile for a ${roleText}. Describe specific business activities.
2. "keywords": 2-3 most important business keywords (products, technology, or industry). Provide them in BOTH Korean and English (e.g., "자율주행, 배터리, Autonomous, Battery"). Avoid generic terms like "technology", "global".
Output in JSON: { "profile": "...", "keywords": "..." }`,
            },
            {
              role: "user",
              content: `Query: "${query}"`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 7000,
        },
      );
      return JSON.parse(response.data.choices[0].message.content);
    } catch (err: any) {
      this.logger.warn(`[AI Query Analysis] Failed: ${err.message}`);
      return { profile: query, keywords: query };
    }
  }

  private async searchWeb(
    query: string,
  ): Promise<{ results: any[]; answer?: string }> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        "[Tavily] TAVILY_API_KEY is not set. Web search disabled.",
      );
      return { results: [], answer: "" };
    }
    try {
      const response = await axios.post(
        "https://api.tavily.com/search",
        {
          api_key: apiKey,
          query,
          search_depth: "basic",
          include_answer: true,
          include_images: false,
          max_results: 15,
        },
        { timeout: 15000 },
      );
      return response.data as { results: any[]; answer?: string };
    } catch (err: any) {
      this.logger.error(`[Tavily] Search failed: ${err.message}`);
      return { results: [], answer: "" };
    }
  }

  private async extractSearchIntent(query: string): Promise<any> {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.GPT_MODEL_ID || "gpt-4o";
    if (!apiKey) return null;

    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model,
          messages: [
            {
              role: "user",
              content: `Extract structured B2B search intent from this query: "${query}"\n\nFields to extract:\n- country: Target region or country (English).\n- role: "Buyer", "Seller", or "Both".\n- subject: Main product or industry (English).\n- webQuery: Optimized English query for a B2B web search (Tavily).\n\nOutput JSON: { "country": "...", "role": "...", "subject": "...", "webQuery": "..." }`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 8000,
        },
      );
      return JSON.parse(response.data.choices[0].message.content) as unknown;
    } catch {
      return null;
    }
  }

  private async getGraphScores(
    buyerMongoId: string,
    sellerMongoIds: string[],
  ): Promise<Record<string, number>> {
    const scores: Record<string, number> = {};
    sellerMongoIds.forEach((id) => {
      scores[id] = 0;
    });

    try {
      const neo4j = await import("neo4j-driver");
      const driver = neo4j.default.driver(
        process.env.NEO4J_URI!,
        neo4j.default.auth.basic(
          process.env.NEO4J_USER || "neo4j",
          process.env.NEO4J_PASSWORD || "",
        ),
      );
      const session = driver.session();
      try {
        const result = await session.executeRead((tx) =>
          tx.run(
            `MATCH (b:Buyer {mongoId: $buyerMongoId})
             MATCH (c:Seller) WHERE c.mongoId IN $sellerMongoIds
             OPTIONAL MATCH (b)-[:INTERESTED_IN]->(i:Industry)<-[:IN_INDUSTRY]-(c)
             OPTIONAL MATCH (b)-[:LOCATED_IN]->(co:Country)<-[:LOCATED_IN]-(c)
             OPTIONAL MATCH (b)-[:NEEDS_TAG]->(t:Tag)<-[:HAS_TAG]-(c)
             RETURN c.mongoId AS mongoId,
                    COUNT(DISTINCT i) * 3.0 AS industryScore,
                    COUNT(DISTINCT co) * 1.0 AS countryScore,
                    COUNT(DISTINCT t) * 1.0 AS tagScore`,
            { buyerMongoId, sellerMongoIds },
          ),
        );
        result.records.forEach((record) => {
          const id = record.get("mongoId") as string;
          scores[id] =
            record.get("industryScore").toNumber() +
            record.get("countryScore").toNumber() +
            record.get("tagScore").toNumber();
        });
      } finally {
        await session.close();
        await driver.close();
      }
    } catch (err: any) {
      this.logger.error(`[Neo4j] Graph scores failed: ${err.message}`);
    }

    return scores;
  }
}

// --- Generic keyword filter ---
const GENERIC_KEYWORD_BLOCKLIST = new Set([
  "솔루션",
  "기술",
  "서비스",
  "시스템",
  "플랫폼",
  "제품",
  "제품군",
  "글로벌",
  "혁신",
  "스마트",
  "디지털",
  "자동화",
  "인공지능",
  "분야",
  "전문",
  "개발",
  "공급",
  "사업",
  "기업",
  "회사",
  "산업",
  "solution",
  "solutions",
  "technology",
  "technologies",
  "service",
  "services",
  "system",
  "systems",
  "platform",
  "platforms",
  "product",
  "products",
  "global",
  "innovation",
  "smart",
  "digital",
  "automation",
  "ai",
  "company",
  "business",
  "industry",
  "development",
  "supply",
]);

function filterGenericKeywords(keywords: string): string {
  if (!keywords) return keywords ?? "";
  const filtered = keywords
    .split(/\s*,\s*/) // 쉼표 기준으로만 분리 — 복합어("Smart Farm") 보존
    .map((w) => w.trim())
    .filter(
      (w) => w.length > 0 && !GENERIC_KEYWORD_BLOCKLIST.has(w.toLowerCase()),
    );
  return filtered.join(" ") || keywords; // 전부 걸리면 원본 fallback
}

// --- Keyword constants ---
const AUTOMOTIVE_KEYWORDS = [
  "자동차",
  "부품",
  "automotive",
  "car parts",
  "ev",
  "machinery",
  "parts",
  "배터리",
  "battery",
];
const KOREA_KEYWORDS = [
  "한국",
  "국내",
  "남한",
  "코리아",
  "korea",
  "south korea",
];
const BUYER_KEYWORDS = [
  "수입업체",
  "수입사",
  "수입상",
  "바이어",
  "구매자",
  "해외바이어",
  "해외구매자",
  "importer",
  "importers",
  "buyer",
  "buyers",
  "purchaser",
  "distributor",
];
const SELLER_KEYWORDS = [
  "수출업체",
  "수출사",
  "수출상",
  "공급업체",
  "공급사",
  "제조업체",
  "제조사",
  "exporter",
  "exporters",
  "supplier",
  "suppliers",
  "manufacturer",
  "seller",
];
const REGION_KEYWORDS = [
  "미국",
  "캐나다",
  "멕시코",
  "브라질",
  "칠레",
  "아르헨티나",
  "콜롬비아",
  "페루",
  "영국",
  "독일",
  "프랑스",
  "이탈리아",
  "스페인",
  "네덜란드",
  "벨기에",
  "러시아",
  "폴란드",
  "터키",
  "일본",
  "중국",
  "인도",
  "베트남",
  "태국",
  "인도네시아",
  "인니",
  "필리핀",
  "말레이시아",
  "싱가포르",
  "호주",
  "대만",
  "사우디",
  "uae",
  "이집트",
  "남아공",
  "나이지리아",
  "아프리카",
  "중남미",
  "중동",
  "동남아",
  "유럽",
  "북미",
  "usa",
  "america",
  "canada",
  "mexico",
  "brazil",
  "uk",
  "germany",
  "france",
  "italy",
  "spain",
  "netherlands",
  "russia",
  "japan",
  "china",
  "india",
  "vietnam",
  "thailand",
  "indonesia",
  "philippines",
  "malaysia",
  "singapore",
  "australia",
  "taiwan",
  "saudi",
  "israel",
  "egypt",
  "africa",
  "latin america",
  "middle east",
  "southeast asia",
  "europe",
  "north america",
];

function buildTavilyQuery(originalQuery: string, intent: string): string {
  const qL = originalQuery.toLowerCase();

  const regionMap = [
    { kr: "미국", en: "USA" },
    { kr: "캐나다", en: "Canada" },
    { kr: "멕시코", en: "Mexico" },
    { kr: "브라질", en: "Brazil" },
    { kr: "영국", en: "UK" },
    { kr: "독일", en: "Germany" },
    { kr: "프랑스", en: "France" },
    { kr: "이탈리아", en: "Italy" },
    { kr: "스페인", en: "Spain" },
    { kr: "일본", en: "Japan" },
    { kr: "중국", en: "China" },
    { kr: "베트남", en: "Vietnam" },
    { kr: "태국", en: "Thailand" },
    { kr: "인도네시아", en: "Indonesia" },
    { kr: "인니", en: "Indonesia" },
    { kr: "필리핀", en: "Philippines" },
    { kr: "말레이시아", en: "Malaysia" },
    { kr: "싱가포르", en: "Singapore" },
    { kr: "호주", en: "Australia" },
    { kr: "인도", en: "India" },
    { kr: "사우디", en: "Saudi Arabia" },
    { kr: "uae", en: "UAE" },
    { kr: "아프리카", en: "Africa" },
    { kr: "중남미", en: "Latin America" },
    { kr: "중동", en: "Middle East" },
    { kr: "동남아", en: "Southeast Asia" },
    { kr: "유럽", en: "Europe" },
  ];

  const productMap = [
    { kr: "자동차부품", en: "automotive parts" },
    { kr: "자동차 부품", en: "automotive parts" },
    { kr: "타이어", en: "tires" },
    { kr: "배터리", en: "EV battery" },
    { kr: "이차전지", en: "lithium battery" },
    { kr: "반도체", en: "semiconductor" },
    { kr: "화장품", en: "cosmetics beauty products" },
    { kr: "식품", en: "food and beverage" },
    { kr: "기계", en: "industrial machinery" },
  ];

  const regionEn =
    regionMap.find((r) => qL.includes(r.kr.toLowerCase()))?.en ?? "";
  const productEn =
    productMap.find((p) => qL.includes(p.kr.toLowerCase()))?.en ?? "";
  const exclude =
    "-software -crm -erp -platform -capterra -linkedin -yelp -facebook -twitter -instagram -pinterest -expo -exhibition -fair -event -conference";

  if (intent === "buyer") {
    return `${regionEn ? regionEn + " " : ""}${productEn ? productEn + " " : ""}importer distributor buyer B2B "contact" ${exclude}`;
  } else if (intent === "seller") {
    return `${regionEn ? regionEn + " " : ""}${productEn ? productEn + " " : ""}exporter supplier manufacturer factory B2B ${exclude}`;
  }
  return originalQuery;
}
