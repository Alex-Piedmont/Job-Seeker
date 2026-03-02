import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-sonnet-4-6";

// Cost per million tokens (USD) — configurable via env vars
const INPUT_COST_PER_M =
  Number(process.env.CLAUDE_INPUT_COST_PER_M) || 3.0;
const OUTPUT_COST_PER_M =
  Number(process.env.CLAUDE_OUTPUT_COST_PER_M) || 15.0;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

export function getModelId(): string {
  return process.env.CLAUDE_MODEL || DEFAULT_MODEL;
}

/**
 * Estimate cost in USD from token counts.
 */
export function estimateCost(
  promptTokens: number,
  completionTokens: number
): number {
  return (
    (promptTokens / 1_000_000) * INPUT_COST_PER_M +
    (completionTokens / 1_000_000) * OUTPUT_COST_PER_M
  );
}

export interface GenerateResumeResult {
  markdown: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  modelId: string;
}

/**
 * Call Claude to generate a tailored resume.
 */
export async function generateResume(
  system: string,
  userMessage: string
): Promise<GenerateResumeResult> {
  const modelId = getModelId();
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: modelId,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const markdown = textBlock?.text ?? "";

  return {
    markdown,
    promptTokens: response.usage.input_tokens,
    completionTokens: response.usage.output_tokens,
    totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    modelId,
  };
}
