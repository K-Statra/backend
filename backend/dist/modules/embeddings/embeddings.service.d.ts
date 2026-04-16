export declare class EmbeddingsService {
    private readonly logger;
    private readonly provider;
    constructor();
    embed(text: string): Promise<number[]>;
    private embedOpenAI;
    private embedHuggingFace;
    private embedMock;
    private hash32;
}
