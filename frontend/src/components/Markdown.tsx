"use client";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface Props {
  content: string;
}

export default function Markdown({ content }: Props) {
  const components: Components = useMemo(() => ({
    h1: ({ children }) => (
      <h1 className="text-xl font-semibold mt-4 mb-2 text-white first:mt-0">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-lg font-semibold mt-4 mb-2 text-white first:mt-0">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-base font-medium mt-3 mb-1.5 text-gray-200 first:mt-0">{children}</h3>
    ),
    p: ({ children }) => (
      <p className="mb-3 leading-relaxed text-gray-100 last:mb-0">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="list-disc pl-5 mb-3 space-y-1 text-gray-200">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal pl-5 mb-3 space-y-1 text-gray-200">{children}</ol>
    ),
    li: ({ children }) => <li className="text-gray-200 leading-relaxed">{children}</li>,
    strong: ({ children }) => (
      <strong className="font-semibold text-white">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-gray-300">{children}</em>
    ),
    // Code — inline vs block
    code: ({ children, className }) => {
      const isBlock = Boolean(className);
      if (isBlock) {
        return (
          <code className="block text-emerald-300 text-sm font-mono leading-relaxed">
            {children}
          </code>
        );
      }
      return (
        <code className="bg-gray-700/70 text-emerald-300 px-1.5 py-0.5 rounded text-[13px] font-mono">
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="bg-gray-950 border border-gray-700/60 rounded-xl p-4 overflow-x-auto my-3 text-sm">
        {children}
      </pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-emerald-500/60 pl-4 my-3 text-gray-300 italic">
        {children}
      </blockquote>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto my-3 rounded-xl border border-gray-700/60">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-gray-800/80">{children}</thead>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2.5 text-left font-medium text-gray-200 border-b border-gray-700/60">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 text-gray-300 border-b border-gray-800/60 last:border-0">
        {children}
      </td>
    ),
    tr: ({ children }) => (
      <tr className="even:bg-gray-800/20">{children}</tr>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300 transition"
      >
        {children}
      </a>
    ),
    hr: () => <hr className="border-gray-700/60 my-4" />,
  }), []);

  if (!content) return null;

  return (
    <div className="prose-content min-w-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}