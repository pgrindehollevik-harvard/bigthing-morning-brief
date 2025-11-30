"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MessageContentProps {
  content: string;
  isUser?: boolean;
}

export default function MessageContent({ content, isUser = false }: MessageContentProps) {
  if (isUser) {
    // User messages: simple text rendering
    return (
      <div className="text-[15px] leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    );
  }

  // Assistant messages: rich markdown rendering
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ node, ...props }) => (
            <h1 className="text-xl font-semibold text-[#1a1a1a] mt-4 mb-2 first:mt-0" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-lg font-semibold text-[#1a1a1a] mt-4 mb-2 first:mt-0" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-base font-semibold text-[#1a1a1a] mt-3 mb-1.5 first:mt-0" {...props} />
          ),
          // Paragraphs
          p: ({ node, ...props }) => (
            <p className="text-[15px] text-[#1a1a1a] leading-relaxed mb-3 last:mb-0" {...props} />
          ),
          // Lists
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-inside space-y-1.5 mb-3 text-[15px] text-[#1a1a1a]" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-inside space-y-1.5 mb-3 text-[15px] text-[#1a1a1a]" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-relaxed" {...props} />
          ),
          // Links
          a: ({ node, href, children, ...props }) => {
            if (!href) return <span {...props}>{children}</span>;
            
            // Extract domain for display
            let displayText = String(children);
            try {
              const url = new URL(href);
              displayText = url.hostname.replace('www.', '');
            } catch (e) {
              // Keep original text if URL parsing fails
            }
            
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0066cc] text-white hover:bg-[#0052a3] transition-colors text-sm font-medium no-underline mx-0.5"
                {...props}
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                {displayText}
              </a>
            );
          },
          // Strong/Bold
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-[#1a1a1a]" {...props} />
          ),
          // Emphasis/Italic
          em: ({ node, ...props }) => (
            <em className="italic" {...props} />
          ),
          // Code
          code: ({ node, inline, ...props }: any) => {
            if (inline) {
              return (
                <code className="bg-gray-200 px-1.5 py-0.5 rounded text-sm font-mono text-[#1a1a1a]" {...props} />
              );
            }
            return (
              <code className="block bg-gray-100 p-3 rounded-lg text-sm font-mono text-[#1a1a1a] overflow-x-auto mb-3" {...props} />
            );
          },
          // Blockquote
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-[#0066cc] pl-4 italic text-[#4a4a4a] my-3" {...props} />
          ),
          // Horizontal rule
          hr: ({ node, ...props }) => (
            <hr className="border-gray-300 my-4" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

