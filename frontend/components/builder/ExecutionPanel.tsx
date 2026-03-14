"use client";

import { ExecutionDto } from "@/types/workflow";

function formatOutput(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

type Props = {
  execution?: ExecutionDto;
  history: Array<Record<string, unknown>>;
  selectedRunId?: string;
  onSelectRun?: (runId: string) => void;
};

export function ExecutionPanel({ execution, history, selectedRunId, onSelectRun }: Props) {
  const latestHistoryStatus = history.length > 0 ? String(history[0].status) : undefined;
  const statusText = latestHistoryStatus ?? execution?.status ?? "idle";
  const runningNodeText =
    execution?.status === "running" && execution.current_node_type
      ? `${execution.current_node_type}${execution.current_node_id ? ` [${execution.current_node_id}]` : ""}`
      : undefined;

  return (
    <div className="h-64 border-t border-slate-200 p-3 text-xs dark:border-slate-800">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Execution</h3>
        <span className="rounded border px-2 py-1">{statusText}</span>
      </div>
      {runningNodeText && (
        <div className="mb-2 rounded border border-sky-300 bg-sky-50 px-2 py-1 text-[11px] text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
          Currently executing: {runningNodeText}
        </div>
      )}

      <div className="grid h-[210px] grid-cols-2 gap-3">
        <div className="overflow-auto rounded border p-2">
          <div className="mb-2 font-semibold">Logs</div>
          {execution?.error && (
            <div className="mb-2 rounded border border-rose-300 bg-rose-50 p-2 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {execution.error}
            </div>
          )}
          {execution?.logs?.map((log) => (
            <div key={`${log.step}-${log.node_id}`} className="mb-2 rounded border p-2">
              <div>[{log.step}] {log.node_type}</div>
              <div className="text-slate-500">{log.message}</div>
              {log.output && (
                <pre className="mt-2 max-h-28 overflow-auto rounded border bg-slate-50 p-2 text-[11px] dark:bg-slate-950">
                  {formatOutput(log.output)}
                </pre>
              )}
            </div>
          ))}
          {execution?.final_output && (
            <div className="rounded border border-emerald-300 bg-emerald-50 p-2 dark:border-emerald-900 dark:bg-emerald-950/40">
              <div className="mb-1 font-semibold text-emerald-700 dark:text-emerald-300">Final Output</div>
              <pre className="max-h-28 overflow-auto rounded border bg-slate-50 p-2 text-[11px] dark:bg-slate-950">
                {formatOutput(execution.final_output)}
              </pre>
            </div>
          )}
        </div>

        <div className="overflow-auto rounded border p-2">
          <div className="mb-2 font-semibold">History (latest 25)</div>
          {history.map((item) => (
            <button
              key={String(item.run_id)}
              type="button"
              className={`mb-2 w-full rounded border p-2 text-left ${
                selectedRunId === String(item.run_id)
                  ? "border-sky-400 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/30"
                  : ""
              }`}
              onClick={() => onSelectRun?.(String(item.run_id))}
            >
              <div>{String(item.run_id).slice(0, 8)}...</div>
              <div className="text-slate-500">{String(item.status)} · {String(item.trigger_type)}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
