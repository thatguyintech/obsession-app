import type { ReactNode } from "react";
import { parseInlineEmphasis, type InlineNode } from "../../lib/inline-emphasis";

function renderInlineNodes(nodes: InlineNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;

    if (node.type === "text") {
      return node.value.length > 0 ? <span key={key}>{node.value}</span> : null;
    }

    const children = renderInlineNodes(node.children, key);
    switch (node.type) {
      case "italic":
        return <em key={key}>{children}</em>;
      case "underline":
        return <u key={key}>{children}</u>;
      case "bold":
        return <strong key={key}>{children}</strong>;
      default:
        return null;
    }
  });
}

interface InlineTextProps {
  text: string;
}

export function InlineText({ text }: InlineTextProps) {
  if (!text) {
    return null;
  }

  const nodes = parseInlineEmphasis(text);
  return <>{renderInlineNodes(nodes, "inline")}</>;
}
