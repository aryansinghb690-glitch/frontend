"use client";

import { NODE_LIBRARY } from "@/components/builder/node-defs";

type Props = {
  onAddNode: (type: (typeof NODE_LIBRARY)[number]["type"]) => void;
};

export function NodePalette({ onAddNode }: Props) {
  return (
    <div className="w-60 border-r border-slate-200 p-3 dark:border-slate-800">
      <h2 className="mb-3 text-sm font-semibold">Node Palette</h2>
      <div className="space-y-2">
        {NODE_LIBRARY.map((node) => (
          <button
            key={node.type}
            onClick={() => onAddNode(node.type)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-left text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
          >
            {node.label}
          </button>
        ))}
      </div>
    </div>
  );
}
