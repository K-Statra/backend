import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import axios from "axios";
import { Company, CompanyDocument } from "../users/schemas/company.schema";
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
  q?: string;
  limit?: number;
  industry?: string;
  country?: string;
  partnership?: string;
  size?: string;
  buyerId?: string;
}

export interface SearchResult {
  data: any[];
  aiResponse: string;
  provider: string;
  debug: Record<string, any>;
}

const SEARCH_PROJECTION = {
  name: 1,
  industry: 1,
  tags: 1,
  location: 1,
  sizeBucket: 1,
  companyIntroduction: 1,
  productIntroduction: 1,
  websiteUrl: 1,
  updatedAt: 1,
} as const;

@Injectable()
export class PartnersService {
  private readonly logger = new Logger(PartnersService.name);

  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  async search(opts: SearchOptions): Promise<SearchResult> {
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
    const predictedIndustry: string | null = null;
    let extractedKeyword = q;
    let tavilyQuery = q ?? "";
    let detectedIntent = "company";
    let intentData: any = null;
    let aiResponse = "";

    if (q) {
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

      extractedKeyword = q;
    }

    // --- 1. DB search (vector) ---
    let dbResults: any[] = [];
    let vector: number[] = [];

    if (!forceWebSearch && q) {
      const strippedQ =
        q
          .replace(
            /(recommend me|please find|show me|find me|how about|search for|찾아줘|추천해줘|알려줘|보여줘)/gi,
            "",
          )
          .trim() || q;
      try {
        vector = await this.embeddingsService.embed(strippedQ);
      } catch {
        vector = [];
      }
    }

    if (!forceWebSearch && vector.length > 0) {
      const pipeline: any[] = [
        {
          $vectorSearch: {
            index: process.env.ATLAS_VECTOR_INDEX,
            path: "embedding",
            queryVector: vector,
            numCandidates: 100,
            limit: Number(limit) * 2,
          },
        },
      ];
      // Seller 만 검색함 (필터 적용)
      const matchStage: Record<string, any> = { type: "seller" };
      if (industry) {
        matchStage.industry = INDUSTRY_MAPPING[industry]
          ? { $in: INDUSTRY_MAPPING[industry] }
          : industry;
      }
      if (country) matchStage["location.country"] = country;
      if (partnership) matchStage.tags = partnership;
      if (size) matchStage.sizeBucket = size;

      if (!matchStage.industry && predictedIndustry) {
        matchStage.industry = INDUSTRY_MAPPING[predictedIndustry]
          ? { $in: INDUSTRY_MAPPING[predictedIndustry] }
          : predictedIndustry;
      }

      if (!matchStage.industry) {
        matchStage.industry = {
          $not: { $regex: /Investment|Fund|Asset|Capital/i },
        };
        matchStage.name = {
          $not: { $regex: /Investment|Fund|Asset|Capital/i },
        };
      }

      if (Object.keys(matchStage).length > 0) {
        pipeline.push({ $match: matchStage });
      }

      pipeline.push({
        $project: {
          ...SEARCH_PROJECTION,
          score: { $meta: "vectorSearchScore" },
        },
      });
      pipeline.push({ $limit: Number(limit) });

      try {
        dbResults = await this.companyModel.aggregate(pipeline);
      } catch (err: any) {
        this.logger.error(`[Search] Vector search error: ${err.message}`);
        dbResults = [];
      }
    }

    // --- 1.5. Text search fallback ---
    if (!forceWebSearch && dbResults.length === 0 && extractedKeyword) {
      const filter: Record<string, any> = {
        $text: { $search: extractedKeyword },
      };
      if (industry)
        filter.industry = INDUSTRY_MAPPING[industry]
          ? { $in: INDUSTRY_MAPPING[industry] }
          : industry;
      if (country) filter["location.country"] = country;
      if (partnership) filter.tags = partnership;
      if (size) filter.sizeBucket = size;

      try {
        const raw = await this.companyModel
          .find(filter)
          .select({ ...SEARCH_PROJECTION, score: { $meta: "textScore" } })
          .sort({ score: { $meta: "textScore" } })
          .limit(Number(limit))
          .lean();
        dbResults = raw.map((r: any) => ({
          ...r,
          score: Math.min(1.0, 0.5 + (r.score as number) / 10),
        }));
      } catch (err: any) {
        this.logger.error(`[Search] Text search error: ${err.message}`);
        dbResults = [];
      }
    }

    // --- 1.8. Filter-only browsing ---
    if (!forceWebSearch && !q && (industry || country || partnership || size)) {
      const filter: Record<string, any> = {};
      if (industry)
        filter.industry = INDUSTRY_MAPPING[industry]
          ? { $in: INDUSTRY_MAPPING[industry] }
          : industry;
      if (country) filter["location.country"] = country;
      if (partnership) filter.tags = partnership;
      if (size) filter.sizeBucket = size;

      const raw = await this.companyModel
        .find(filter, SEARCH_PROJECTION)
        .limit(Number(limit))
        .sort({ updatedAt: -1 })
        .lean();
      dbResults = raw.map((r) => ({ ...r, score: 1.0 }));
    }

    // --- 1.9. Default show-all ---
    if (!forceWebSearch && !q && dbResults.length === 0) {
      const raw = await this.companyModel
        .find({}, SEARCH_PROJECTION)
        .limit(Number(limit))
        .lean();
      dbResults = raw.map((r) => ({ ...r, score: 1.0 }));
    }

    // --- 2. Web search fallback ---
    const shouldFallbackToWeb = forceWebSearch || dbResults.length === 0;

    if (shouldFallbackToWeb && q) {
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
          companyIntroduction: item.content,
          websiteUrl: item.url,
          tags: ["Web"],
          score: Math.min(1.0, Math.max(0.1, score)),
        };
      });

      if (intentData?.country) {
        const countryLower = (intentData.country as string).toLowerCase();
        mappedWebResults = mappedWebResults.map((item: any) => {
          const text = (
            (item.profileText || "") +
            " " +
            (item.name || "")
          ).toLowerCase();
          if (!text.includes(countryLower))
            return { ...item, score: item.score * 0.7 };
          return item;
        });
      }

      mappedWebResults.sort((a: any, b: any) => b.score - a.score);

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
        },
      };
    }

    // --- 3. Neo4j graph re-ranking (optional) ---
    let hybridResults = dbResults;
    if (process.env.NEO4J_URI && dbResults.length > 0 && buyerId) {
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
      },
    };
  }

  // Seller 만 검색함 (필터 적용)
  async getDebugInfo() {
    const docCount = await this.companyModel.countDocuments();
    const embeddingCount = await this.companyModel.countDocuments({
      embedding: { $exists: true, $not: { $size: 0 } },
    });
    const industryStats = await this.companyModel.aggregate([
      { $match: { type: "seller" } },
      { $group: { _id: "$industry", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);
    const sampleData = await this.companyModel
      .find({}, { name: 1, industry: 1, companyIntroduction: 1 })
      .limit(5)
      .lean();

    let embeddingStatus = "Not Tested";
    let embeddingError: string | null = null;
    try {
      const v = await this.embeddingsService.embed("test");
      embeddingStatus = `Success (Length: ${v.length})`;
    } catch (e: any) {
      embeddingStatus = "Failed";
      embeddingError = e.message as string;
    }

    return {
      status: "ok",
      env: {
        ATLAS_VECTOR_INDEX: process.env.ATLAS_VECTOR_INDEX || "(not set)",
        OPENAI_API_KEY_EXISTS: !!process.env.OPENAI_API_KEY,
        MONGO_URI_CONFIGURED: !!process.env.MONGODB_URI,
        NODE_ENV: process.env.NODE_ENV,
      },
      db: { status: "Connected", companyCount: docCount },
      embedding: { status: embeddingStatus, error: embeddingError },
      sampleData,
      industryStats,
      embeddingCount,
    };
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
    companyMongoIds: string[],
  ): Promise<Record<string, number>> {
    const scores: Record<string, number> = {};
    companyMongoIds.forEach((id) => {
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
             MATCH (c:Company) WHERE c.mongoId IN $companyMongoIds
             OPTIONAL MATCH (b)-[:INTERESTED_IN]->(i:Industry)<-[:IN_INDUSTRY]-(c)
             OPTIONAL MATCH (b)-[:LOCATED_IN]->(co:Country)<-[:LOCATED_IN]-(c)
             OPTIONAL MATCH (b)-[:NEEDS_TAG]->(t:Tag)<-[:HAS_TAG]-(c)
             RETURN c.mongoId AS mongoId,
                    COUNT(DISTINCT i) * 3.0 AS industryScore,
                    COUNT(DISTINCT co) * 1.0 AS countryScore,
                    COUNT(DISTINCT t) * 1.0 AS tagScore`,
            { buyerMongoId, companyMongoIds },
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
    return `${regionEn ? regionEn + " " : ""}${productEn ? productEn + " " : ""}importer distributor buyer B2B company "contact" ${exclude}`;
  } else if (intent === "seller") {
    return `${regionEn ? regionEn + " " : ""}${productEn ? productEn + " " : ""}exporter supplier manufacturer factory B2B ${exclude}`;
  }
  return originalQuery;
}
