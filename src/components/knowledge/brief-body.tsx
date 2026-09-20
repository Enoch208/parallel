interface TitleBlock {
  readonly kind: "title" | "goal" | "paragraph";
  readonly text: string;
}

interface ClaimBlock {
  readonly kind: "claim";
  readonly text: string;
  readonly source: string | null;
}

type BriefBlock = TitleBlock | ClaimBlock;

export function parseBriefBody(body: string): BriefBlock[] {
  const blocks: BriefBlock[] = [];

  for (const line of body.split("\n")) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push({ kind: "goal", text: trimmed.slice(3) });
      continue;
    }

    if (trimmed.startsWith("# ")) {
      blocks.push({ kind: "title", text: trimmed.slice(2) });
      continue;
    }

    if (trimmed.startsWith("- ")) {
      blocks.push({ kind: "claim", text: trimmed.slice(2), source: null });
      continue;
    }

    const previous = blocks.at(-1);

    if (trimmed.startsWith("Source:") && previous !== undefined && previous.kind === "claim") {
      blocks[blocks.length - 1] = { ...previous, source: trimmed.slice("Source:".length).trim() };
      continue;
    }

    blocks.push({ kind: "paragraph", text: trimmed });
  }

  return blocks;
}

export function BriefBody({ body }: { body: string }) {
  const blocks = parseBriefBody(body);

  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, index) => {
        const key = `${block.kind}-${String(index)}`;

        if (block.kind === "claim") {
          return (
            <div key={key} className="flex min-w-0 flex-col gap-1.5 border-l border-white/10 pl-4">
              <p className="text-sm leading-relaxed text-neutral-200">{block.text}</p>
              {block.source !== null && (
                <span className="w-fit max-w-full rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-light break-words text-neutral-400">
                  Source: {block.source}
                </span>
              )}
            </div>
          );
        }

        if (block.kind === "title") {
          return (
            <h3 key={key} className="text-lg font-medium tracking-tight text-white">
              {block.text}
            </h3>
          );
        }

        if (block.kind === "goal") {
          return (
            <h4
              key={key}
              className="mt-2 border-t border-white/5 pt-4 text-sm font-medium text-blue-200"
            >
              {block.text}
            </h4>
          );
        }

        return (
          <p key={key} className="text-sm leading-relaxed font-light text-neutral-300">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
