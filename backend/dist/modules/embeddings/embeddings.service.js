"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var EmbeddingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingsService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
let EmbeddingsService = EmbeddingsService_1 = class EmbeddingsService {
    logger = new common_1.Logger(EmbeddingsService_1.name);
    provider;
    constructor() {
        this.provider = (process.env.EMBEDDINGS_PROVIDER || 'mock').toLowerCase();
    }
    async embed(text) {
        try {
            switch (this.provider) {
                case 'openai':
                    return await this.embedOpenAI(text);
                case 'huggingface':
                    return await this.embedHuggingFace(text);
                default:
                    return this.embedMock(text);
            }
        }
        catch {
            return [];
        }
    }
    async embedOpenAI(text) {
        const apiKey = process.env.OPENAI_API_KEY;
        const model = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';
        if (!apiKey)
            return [];
        try {
            const res = await axios_1.default.post('https://api.openai.com/v1/embeddings', { input: text, model }, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: Number(process.env.OPENAI_TIMEOUT_MS || 20000),
            });
            const vec = res.data?.data?.[0]?.embedding;
            if (!Array.isArray(vec))
                return [];
            return vec.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));
        }
        catch (err) {
            if (process.env.OPENAI_DEBUG === '1') {
                this.logger.warn(`[OpenAI] embed error: ${err.message}`);
            }
            return [];
        }
    }
    async embedHuggingFace(text) {
        const apiToken = process.env.HF_API_TOKEN;
        const model = process.env.HF_EMBEDDING_MODEL || 'intfloat/multilingual-e5-small';
        if (!apiToken)
            return [];
        const url = `https://api-inference.huggingface.co/pipeline/feature-extraction/${encodeURIComponent(model)}?wait_for_model=true`;
        try {
            const res = await axios_1.default.post(url, String(text || ''), {
                headers: {
                    Authorization: `Bearer ${apiToken}`,
                    'Content-Type': 'text/plain',
                },
                timeout: Number(process.env.HF_TIMEOUT_MS || 20000),
            });
            let vec = Array.isArray(res.data) ? res.data : [];
            if (Array.isArray(vec[0]))
                vec = vec[0];
            return vec.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));
        }
        catch (err) {
            if (process.env.HF_DEBUG === '1') {
                this.logger.warn(`[HuggingFace] embed error: ${err.message}`);
            }
            return [];
        }
    }
    embedMock(text, dim = 64) {
        const t = String(text || '');
        const v = new Array(dim).fill(0);
        if (!t)
            return v;
        for (let i = 0; i < t.length; i++) {
            const window = t.slice(i, i + 4);
            const h = this.hash32(window);
            const idx = h % dim;
            const val = ((h / 0xffffffff) * 2 - 1) * 0.5;
            v[idx] += val;
        }
        const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
        if (!Number.isFinite(norm) || norm === 0)
            return v;
        return v.map((x) => x / norm);
    }
    hash32(str) {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }
};
exports.EmbeddingsService = EmbeddingsService;
exports.EmbeddingsService = EmbeddingsService = EmbeddingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], EmbeddingsService);
//# sourceMappingURL=embeddings.service.js.map