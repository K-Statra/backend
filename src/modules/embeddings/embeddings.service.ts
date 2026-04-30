import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly provider: string;

  constructor() {
    this.provider = (process.env.EMBEDDINGS_PROVIDER || "mock").toLowerCase();
  }

  async embed(text: string): Promise<number[]> {
    try {
      switch (this.provider) {
        case "openai":
          return await this.embedOpenAI(text);
        case "huggingface":
          return await this.embedHuggingFace(text);
        default:
          return this.embedMock(text);
      }
    } catch (err) {
      this.logger.error(`[EmbeddingsService] embed error {err: ${err}}`);
      return [];
    }
  }

  private async embedOpenAI(text: string): Promise<number[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";
    if (!apiKey) return [];

    try {
      const res = await axios.post(
        "https://api.openai.com/v1/embeddings",
        { input: text, model },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: Number(process.env.OPENAI_TIMEOUT_MS || 20000),
        },
      );
      const vec = res.data?.data?.[0]?.embedding;
      if (!Array.isArray(vec)) return [];
      return vec.map((v: number) =>
        Number.isFinite(Number(v)) ? Number(v) : 0,
      );
    } catch (err: any) {
      if (process.env.OPENAI_DEBUG === "1") {
        this.logger.warn(`[OpenAI] embed error: ${err.message}`);
      }
      return [];
    }
  }

  private async embedHuggingFace(text: string): Promise<number[]> {
    const apiToken = process.env.HF_API_TOKEN;
    const model =
      process.env.HF_EMBEDDING_MODEL || "intfloat/multilingual-e5-small";
    if (!apiToken) return [];

    const url = `https://api-inference.huggingface.co/pipeline/feature-extraction/${encodeURIComponent(model)}?wait_for_model=true`;
    try {
      const res = await axios.post(url, String(text || ""), {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "text/plain",
        },
        timeout: Number(process.env.HF_TIMEOUT_MS || 20000),
      });
      let vec = Array.isArray(res.data) ? res.data : [];
      if (Array.isArray(vec[0])) vec = vec[0];
      return vec.map((v: number) =>
        Number.isFinite(Number(v)) ? Number(v) : 0,
      );
    } catch (err: any) {
      if (process.env.HF_DEBUG === "1") {
        this.logger.warn(`[HuggingFace] embed error: ${err.message}`);
      }
      return [];
    }
  }

  private embedMock(text: string, dim = 64): number[] {
    const t = String(text || "");
    const v = new Array(dim).fill(0) as number[];
    if (!t) return v;

    for (let i = 0; i < t.length; i++) {
      const window = t.slice(i, i + 4);
      const h = this.hash32(window);
      const idx = h % dim;
      const val = ((h / 0xffffffff) * 2 - 1) * 0.5;
      v[idx] += val;
    }

    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    if (!Number.isFinite(norm) || norm === 0) return v;
    return v.map((x) => x / norm);
  }

  private hash32(str: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
}
