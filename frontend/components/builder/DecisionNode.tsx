"use client";

import { Handle, NodeProps, Position } from "@xyflow/react";

import { WorkflowNodeData } from "@/types/workflow";

export function DecisionNode({ data }: NodeProps) {
  const typed = data as WorkflowNodeData;
  return (
    <div className="min-w-44 rounded-md border border-amber-500 bg-amber-50 p-3 text-xs dark:bg-amber-950/30">
      <Handle type="target" position={Position.Left} />
      <div className="font-semibold">{typed.label}</div>
      <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">if {String((typed.config || {}).field || "field")} {String((typed.config || {}).operator || "equals")}</div>
      <Handle id="true" type="source" position={Position.Right} style={{ top: 18, background: "#10b981" }} />
      <Handle id="false" type="source" position={Position.Right} style={{ top: 42, background: "#ef4444" }} />
      <div className="mt-2 flex justify-between text-[10px] font-semibold">
        <span className="text-emerald-600">True</span>
        <span className="text-rose-600">False</span>
      </div>
    </div>
  );
}
