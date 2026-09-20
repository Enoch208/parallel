const responsesEndpoint = "https://api.openai.com/v1/responses";

export const extractionModel = "gpt-5.4-mini";

export interface StructuredRequest {
  readonly model: string;
  readonly system: string;
  readonly user: string;
  readonly schemaName: string;
  readonly schema: Record<string, unknown>;
  readonly apiKey: string;
}

export async function structuredOutput(request: StructuredRequest): Promise<unknown> {
  const response = await fetch(responsesEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: request.model,
      input: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
      text: {
        format: {
          type: "json_schema",
          name: request.schemaName,
          strict: true,
          schema: request.schema,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI returned ${String(response.status)}`);
  }

  const payload = (await response.json()) as {
    output?: { type?: string; content?: { type?: string; text?: string }[] }[];
  };

  const messages = payload.output === undefined ? [] : payload.output;
  const text = messages
    .filter((item) => item.type === "message")
    .flatMap((item) => (item.content === undefined ? [] : item.content))
    .filter((part) => part.type === "output_text")
    .map((part) => (part.text === undefined ? "" : part.text))
    .join("");

  if (text.length === 0) {
    throw new Error("OpenAI returned no structured output");
  }

  return JSON.parse(text);
}
