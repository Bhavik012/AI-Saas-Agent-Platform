import { GoogleGenerativeAI } from "@google/generative-ai";

let _genAI: GoogleGenerativeAI | null = null;
let _geminiModel: ReturnType<GoogleGenerativeAI["getGenerativeModel"]> | null = null;

export const getGeminiApiKey = (): string => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY environment variable is not defined");
    }
    return apiKey;
};

export const getGeminiModel = (): ReturnType<GoogleGenerativeAI["getGenerativeModel"]> => {
    if (!_geminiModel) {
        const apiKey = getGeminiApiKey();
        _genAI = new GoogleGenerativeAI(apiKey);
        _geminiModel = _genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
        });
    }
    return _geminiModel;
};

export const resetGeminiModelForTesting = (): void => {
    _genAI = null;
    _geminiModel = null;
};

export const geminiModel = new Proxy({} as ReturnType<GoogleGenerativeAI["getGenerativeModel"]>, {
    get(_target, prop, receiver) {
        return Reflect.get(getGeminiModel(), prop, receiver);
    },
});
