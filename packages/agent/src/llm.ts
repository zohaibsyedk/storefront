import { execFile } from "node:child_process";
import type { z } from "zod";

/**
 * Model access behind one function. Order of preference:
 *   1. ANTHROPIC_API_KEY set           -> Anthropic Messages API
 *   2. STOREFRONT_LLM=claude-cli       -> the local `claude` CLI (uses your Claude Code login)
 *   3. otherwise                       -> "house" mode: deterministic writers, no model call
 * Every caller supplies a fallback, and model output is only used if it passes the schema,
 * so the product behaves the same with or without a model, only with plainer copy.
 */
export type LlmProvider = "anthropic" | "claude-cli" | "house";

export function llmProvider(): LlmProvider {
  if (process.env.STOREFRONT_LLM === "house") return "house";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.STOREFRONT_LLM === "claude-cli") return "claude-cli";
  return "house";
}

const MODELS = { strong: "claude-opus-5-5", fast: "claude-haiku-5-5" } as const;

async function callAnthropic(system: string, prompt: string, tier: keyof typeof MODELS): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.STOREFRONT_MODEL ?? MODELS[tier], max_tokens: 4000, system, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  return data.content.map((c) => c.text ?? "").join("");
}

function callCli(system: string, prompt: string, tier: keyof typeof MODELS): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "claude",
      ["-p", "--model", tier === "strong" ? "sonnet" : "haiku", "--append-system-prompt", system],
      { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => (err ? reject(err) : resolve(stdout)),
    );
    child.stdin?.end(prompt);
  });
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in model output");
  return JSON.parse(body.slice(start, end + 1));
}

export interface LlmResult<T> {
  value: T;
  source: LlmProvider;
  error?: string;
}

export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  fallback: () => T;
  tier?: keyof typeof MODELS;
  /** Extra validation (lint, policy). Return an error string to reject the output. */
  check?: (value: T) => string | null;
}): Promise<LlmResult<T>> {
  const provider = llmProvider();
  if (provider === "house") return { value: opts.fallback(), source: "house" };
  const system = `${opts.system}\n\nReply with one JSON object only. No prose before or after it.`;
  try {
    const text = provider === "anthropic" ? await callAnthropic(system, opts.prompt, opts.tier ?? "fast") : await callCli(system, opts.prompt, opts.tier ?? "fast");
    const parsed = opts.schema.parse(extractJson(text));
    const problem = opts.check?.(parsed);
    if (problem) throw new Error(problem);
    return { value: parsed, source: provider };
  } catch (err) {
    return { value: opts.fallback(), source: "house", error: err instanceof Error ? err.message : String(err) };
  }
}

/** Untrusted text (owner input, scraped pages) is always passed as data, never as instructions. */
export function asData(label: string, value: unknown): string {
  return `<${label}>\n${JSON.stringify(value, null, 1)}\n</${label}>`;
}
