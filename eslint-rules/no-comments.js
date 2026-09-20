const isShebang = (comment) =>
  comment.type === "Shebang" || (comment.type === "Line" && comment.value.startsWith("!"));

export const noComments = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow comments; names, small functions and real types carry the meaning",
    },
    schema: [],
    messages: {
      found: "Comments are not allowed. Rename or split the code so it explains itself.",
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (isShebang(comment)) continue;
          context.report({ loc: comment.loc, messageId: "found" });
        }
      },
    };
  },
};
