import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_OPENAI_MODEL,
  resolveOpenAiModelId,
} from "./openai-client";

describe("resolveOpenAiModelId", () => {
  const prior = process.env.OPENAI_MODEL;

  afterEach(() => {
    if (prior === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = prior;
  });

  it("defaults to gpt-5.5", () => {
    delete process.env.OPENAI_MODEL;
    expect(DEFAULT_OPENAI_MODEL).toBe("gpt-5.5");
    expect(resolveOpenAiModelId()).toBe("gpt-5.5");
  });

  it("respects OPENAI_MODEL override", () => {
    process.env.OPENAI_MODEL = "gpt-4o-mini";
    expect(resolveOpenAiModelId()).toBe("gpt-4o-mini");
  });
});
