import { generateObject } from "ai";
import type { z } from "zod";
import { resolveOpenAiModelId } from "@/lib/ai/openai-client";
import { openAiChatModel } from "@/lib/ai/openai-client";
import {
  recordOpenAiUsage,
  type UsageRecordContext,
} from "@/lib/usage/record-provider-usage";

type TrackedGenerateParams<Schema extends z.ZodType> = {
  schema: Schema;
  prompt: string;
  model?: ReturnType<typeof openAiChatModel>;
};

export async function generateObjectTracked<Schema extends z.ZodType>(
  context: UsageRecordContext,
  params: TrackedGenerateParams<Schema>,
): Promise<Awaited<ReturnType<typeof generateObject<Schema>>>> {
  const result = await generateObject({
    model: params.model ?? openAiChatModel(),
    schema: params.schema,
    prompt: params.prompt,
  });
  void recordOpenAiUsage({
    context,
    usage: {
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      totalTokens: result.usage?.totalTokens,
    },
    model: resolveOpenAiModelId(),
  });
  return result;
}
