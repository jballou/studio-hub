import type { ReactNode } from "react";

// Renders Jira's rich-text description (Atlassian Document Format) as React elements, so headings, lists, bold, links,
// spacing and line breaks come through the way they look in Jira. No HTML is injected, and links are limited to
// web and mail addresses.

type Mark = { type: string; attrs?: Record<string, unknown> };
type Node = { type: string; text?: string; attrs?: Record<string, unknown>; marks?: Mark[]; content?: Node[] };

const safeHref = (h: unknown): string | null => {
  try {
    const u = new URL(String(h));
    return ["http:", "https:", "mailto:"].includes(u.protocol) ? u.toString() : null;
  } catch { return null; }
};

const PANEL: Record<string, string> = {
  info: "border-info-line bg-info-bg", note: "border-info-line bg-info-bg", warning: "border-warn-line bg-warn-bg",
  success: "border-ok-line bg-ok-bg", error: "border-bad-line bg-bad-bg",
};

function text(n: Node, key: number): ReactNode {
  let out: ReactNode = n.text ?? "";
  for (const m of n.marks ?? []) {
    if (m.type === "strong") out = <strong key={`s${key}`}>{out}</strong>;
    else if (m.type === "em") out = <em key={`e${key}`}>{out}</em>;
    else if (m.type === "strike") out = <s key={`x${key}`}>{out}</s>;
    else if (m.type === "underline") out = <u key={`u${key}`}>{out}</u>;
    else if (m.type === "code") out = <code key={`c${key}`} className="rounded bg-n-150 px-1 py-0.5 font-mono text-[0.85em]">{out}</code>;
    else if (m.type === "subsup") out = m.attrs?.type === "sub" ? <sub key={`b${key}`}>{out}</sub> : <sup key={`p${key}`}>{out}</sup>;
    else if (m.type === "link") {
      const href = safeHref(m.attrs?.href);
      out = href ? <a key={`l${key}`} href={href} target="_blank" rel="noopener noreferrer" className="text-brand underline">{out}</a> : out;
    }
  }
  return out;
}

function kids(n: Node): ReactNode {
  return (n.content ?? []).map((c, i) => <Block key={i} n={c} i={i} />);
}

function Block({ n, i }: { n: Node; i: number }): ReactNode {
  switch (n.type) {
    case "text": return <span key={i} className="whitespace-pre-wrap">{text(n, i)}</span>;
    case "hardBreak": return <br key={i} />;
    case "paragraph": return <p className="mb-2 min-h-[1.25em] whitespace-pre-wrap last:mb-0">{kids(n)}</p>;
    case "heading": {
      const level = Math.min(Math.max(Number(n.attrs?.level) || 3, 1), 6);
      const cls = ["text-xl", "text-lg", "text-base", "text-base", "text-sm", "text-sm"][level - 1];
      const H = `h${Math.min(level + 1, 6)}` as "h2";
      return <H className={`mb-2 mt-4 font-semibold first:mt-0 ${cls}`}>{kids(n)}</H>;
    }
    case "bulletList": return <ul className="mb-2 list-disc space-y-1 pl-6">{kids(n)}</ul>;
    case "orderedList": return <ol className="mb-2 list-decimal space-y-1 pl-6" start={Number(n.attrs?.order) || 1}>{kids(n)}</ol>;
    case "listItem": return <li>{kids(n)}</li>;
    case "taskList": return <ul className="mb-2 space-y-1">{kids(n)}</ul>;
    case "taskItem": return <li className="flex items-start gap-2"><input type="checkbox" disabled checked={n.attrs?.state === "DONE"} className="mt-1 accent-brand" aria-label={n.attrs?.state === "DONE" ? "Done" : "Not done"} /><span>{kids(n)}</span></li>;
    case "blockquote": return <blockquote className="mb-2 border-l-4 border-line pl-3 text-muted">{kids(n)}</blockquote>;
    case "codeBlock": return <pre className="mb-2 overflow-x-auto rounded-lg bg-n-150 p-3 font-mono text-xs">{(n.content ?? []).map((c) => c.text ?? "").join("")}</pre>;
    case "rule": return <hr className="my-3 border-line" />;
    case "panel": return <div className={`mb-2 rounded-lg border p-3 ${PANEL[String(n.attrs?.panelType)] ?? PANEL.info}`}>{kids(n)}</div>;
    case "expand":
    case "nestedExpand": return <details className="mb-2 rounded-lg border border-line p-2"><summary className="cursor-pointer font-medium">{String(n.attrs?.title ?? "Details")}</summary><div className="mt-2">{kids(n)}</div></details>;
    case "table": return <div className="mb-2 overflow-x-auto"><table className="w-full border-collapse text-sm"><tbody>{kids(n)}</tbody></table></div>;
    case "tableRow": return <tr>{kids(n)}</tr>;
    case "tableHeader": return <th className="border border-line bg-n-150 px-2 py-1 text-left align-top font-semibold">{kids(n)}</th>;
    case "tableCell": return <td className="border border-line px-2 py-1 align-top">{kids(n)}</td>;
    case "mention": return <span className="rounded bg-info-bg px-1 text-info-fg">{String(n.attrs?.text ?? "@someone")}</span>;
    case "emoji": return <span>{String(n.attrs?.text ?? n.attrs?.shortName ?? "")}</span>;
    case "status": return <span className="rounded bg-n-150 px-1.5 py-0.5 text-xs font-semibold uppercase">{String(n.attrs?.text ?? "")}</span>;
    case "date": return <time className="rounded bg-n-150 px-1.5 py-0.5 text-xs">{n.attrs?.timestamp ? new Date(Number(n.attrs.timestamp)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}</time>;
    case "inlineCard":
    case "blockCard": {
      const href = safeHref(n.attrs?.url);
      return href ? <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-brand underline">{href}</a> : null;
    }
    // Attachments live in Jira; say so rather than showing a blank gap.
    case "mediaSingle":
    case "mediaGroup":
    case "media": return <p className="mb-2 text-xs italic text-muted">[Attachment, see it in Jira]</p>;
    default: return n.content ? <>{kids(n)}</> : null;
  }
}

/** Jira description, formatted as in Jira. Pass the `descriptionAdf` document from the ticket. */
export function Adf({ doc }: { doc: unknown }) {
  const root = doc as Node | null;
  if (!root || root.type !== "doc" || !root.content?.length) return null;
  return <div className="text-sm leading-relaxed [&_li>p]:mb-0">{kids(root)}</div>;
}
