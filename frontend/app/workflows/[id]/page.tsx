"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { ExecutionPanel } from "@/components/builder/ExecutionPanel";
import { NodeConfigPanel } from "@/components/builder/NodeConfigPanel";
import { WorkflowCanvas } from "@/components/builder/WorkflowCanvas";
import { workflowApi, fromBackendGraph } from "@/lib/api/client";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import { ExecutionDto, ValidationError, ValidationErrorItem } from "@/types/workflow";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export default function WorkflowPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const routeId = params.id;

  const workflowId = useWorkflowStore((s) => s.workflowId);
  const name = useWorkflowStore((s) => s.name);
  const createdAt = useWorkflowStore((s) => s.createdAt);
  const updatedAt = useWorkflowStore((s) => s.updatedAt);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const setWorkflowMeta = useWorkflowStore((s) => s.setWorkflowMeta);
  const setGraph = useWorkflowStore((s) => s.setGraph);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const clearWorkflow = useWorkflowStore((s) => s.clearWorkflow);

  const [execution, setExecution] = useState<ExecutionDto>();
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [isDark, setIsDark] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; text?: string; errors?: ValidationErrorItem[] } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadExecution = async (runId: string) => {
    const details = await workflowApi.getExecution(runId);
    setExecution(details);
  };

  const showNotice = (type: "success" | "error" | "info", text: string, timeoutMs = 3500) => {
    setNotice({ type, text });
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
    }
    noticeTimer.current = setTimeout(() => setNotice(null), timeoutMs);
  };

  const showValidationErrors = (errors: ValidationErrorItem[]) => {
    setNotice({ type: "error", errors });
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
    }
    noticeTimer.current = setTimeout(() => setNotice(null), 8000);
  };

  const handleError = (error: unknown) => {
    if (error instanceof ValidationError) {
      showValidationErrors(error.errors);
    } else {
      showNotice("error", getErrorMessage(error));
    }
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) {
        clearTimeout(noticeTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      if (routeId === "new") {
        setWorkflowMeta(undefined, "Untitled Workflow");
        setGraph([], []);
        setHistory([]);
        return;
      }
      const workflow = await workflowApi.get(routeId);
      const graph = fromBackendGraph(workflow);
      setWorkflowMeta(workflow.workflow_id, workflow.name, {
        createdAt: workflow.created_at,
        updatedAt: workflow.updated_at,
      });
      setGraph(graph.nodes, graph.edges);
      const runs = await workflowApi.listExecutions(workflow.workflow_id);
      setHistory(runs);
      if (runs.length > 0) {
        const latestRunId = String(runs[0].run_id);
        await loadExecution(latestRunId);
      }
    };
    load().catch((error) => {
      const message = getErrorMessage(error);
      setWorkflowMeta(undefined, "Untitled Workflow");
      setGraph([], []);
      setHistory([]);
      setExecution(undefined);

      if (message.includes("Workflow not found") && routeId !== "new") {
        showNotice("info", "This workflow no longer exists. Redirecting to a new workflow.");
        router.replace("/workflows/new");
        return;
      }

      showNotice("error", message);
    });
  }, [routeId, router, setGraph, setWorkflowMeta]);

  useEffect(() => {
    if (!workflowId) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        // Light polling keeps the history/execution panes feeling current without websockets.
        const runs = await workflowApi.listExecutions(workflowId);
        if (cancelled) {
          return;
        }

        setHistory(runs);

        const currentRunId = execution?.run_id ? String(execution.run_id) : undefined;
        const latestRunId = runs.length > 0 ? String(runs[0].run_id) : undefined;
        const latestStatus = runs.length > 0 ? String(runs[0].status) : undefined;

        if (latestRunId && latestStatus === "running" && currentRunId !== latestRunId) {
          const latestDetails = await workflowApi.getExecution(latestRunId);
          if (!cancelled) {
            setExecution(latestDetails);
          }
          return;
        }

        if (!currentRunId && latestRunId) {
          const latestDetails = await workflowApi.getExecution(latestRunId);
          if (!cancelled) {
            setExecution(latestDetails);
          }
          return;
        }

        if (currentRunId) {
          const currentSummary = runs.find((item) => String(item.run_id) === currentRunId);
          if (currentSummary && String(currentSummary.status) === "running") {
            const currentDetails = await workflowApi.getExecution(currentRunId);
            if (!cancelled) {
              setExecution(currentDetails);
            }
          }
        }
      } catch {
      }
    };

    poll().catch(() => {});
    const interval = setInterval(() => {
      poll().catch(() => {});
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [workflowId, execution?.run_id]);

  const saveWorkflow = async () => {
    try {
      const saved = workflowId
        ? await workflowApi.update(workflowId, name, nodes, edges)
        : await workflowApi.create(name, nodes, edges);
      const graph = fromBackendGraph(saved);
      setWorkflowMeta(saved.workflow_id, saved.name, {
        createdAt: saved.created_at,
        updatedAt: saved.updated_at,
      });
      setGraph(graph.nodes, graph.edges);
      if (routeId === "new") router.replace(`/workflows/${saved.workflow_id}`);
      showNotice("success", "Workflow saved");
    } catch (error) {
      handleError(error);
    }
  };

  const runWorkflow = async () => {
    if (!workflowId) {
      showNotice("info", "Save workflow before running");
      return;
    }

    try {
      const trigger = nodes.find((n) => n.data.type === "manual_trigger");
      const payload = (trigger?.data.config.initial_payload as Record<string, unknown>) || {};

      const started = await workflowApi.run(workflowId, payload, "manual_trigger", nodes, edges);
      const runId = started.run_id;
      showNotice("info", "Workflow run accepted");

      // Short-lived poll just for this run so the panel updates right away.
      const interval = setInterval(async () => {
        try {
          const latest = await workflowApi.getExecution(runId);
          setExecution(latest);
          if (latest.status !== "running") {
            clearInterval(interval);
            const runs = await workflowApi.listExecutions(workflowId);
            setHistory(runs);
          }
        } catch (error) {
          clearInterval(interval);
          handleError(error);
        }
      }, 1500);
    } catch (error) {
      handleError(error);
    }
  };

  const exportWorkflow = async () => {
    if (!workflowId) {
      showNotice("info", "Save workflow first");
      return;
    }

    try {
      const data = await workflowApi.export(workflowId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${workflowId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showNotice("error", getErrorMessage(error));
    }
  };

  const importWorkflow = async (file: File) => {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const imported = await workflowApi.import(payload);
      router.replace(`/workflows/${imported.workflow_id}`);
    } catch (error) {
      showNotice("error", getErrorMessage(error));
    }
  };

  const webhookUrl = useMemo(() => (workflowId ? `${process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api"}/webhooks/${workflowId}` : undefined), [workflowId]);

  return (
    <main className="workflow-shell h-screen min-h-screen">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <input
            className="rounded border px-3 py-1 text-sm"
            value={name}
            onChange={(e) =>
              setWorkflowMeta(workflowId, e.currentTarget.value, {
                createdAt,
                updatedAt,
              })
            }
          />
          <button className="rounded border px-3 py-1 text-xs" onClick={saveWorkflow}>Save</button>
          <button className="rounded border px-3 py-1 text-xs" onClick={runWorkflow}>Run Workflow</button>
          <button className="rounded border px-3 py-1 text-xs" onClick={exportWorkflow}>Export</button>
          <label className="rounded border px-3 py-1 text-xs">
            Import
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.currentTarget.files?.[0] && importWorkflow(e.currentTarget.files[0])}
            />
          </label>
          <button className="rounded border px-3 py-1 text-xs" onClick={undo}>Undo</button>
          <button className="rounded border px-3 py-1 text-xs" onClick={redo}>Redo</button>
          <button
            title="Clear workflow"
            className="rounded border px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={() => { if (confirm("Clear all nodes and edges?")) clearWorkflow(); }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
        <button className="rounded border px-3 py-1 text-xs" onClick={() => setIsDark((v) => !v)}>{isDark ? "Light" : "Dark"} mode</button>
      </div>

      {notice && (
        <div
          className={`mx-4 mt-3 rounded border px-3 py-2 text-xs ${
            notice.type === "error"
              ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
              : notice.type === "success"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300"
          }`}
        >
          {notice.errors ? (
            <div>
              <p className="mb-1 font-semibold">Workflow has validation errors:</p>
              <ul className="space-y-0.5 list-none">
                {notice.errors.map((e, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="mt-px shrink-0 rounded bg-rose-200 px-1 py-0 font-mono text-[10px] dark:bg-rose-900">
                      {e.code}
                    </span>
                    <span>
                      {e.message}
                      {e.node_id && (
                        <span className="ml-1 font-mono opacity-60">[{e.node_id}]</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            notice.text
          )}
        </div>
      )}

      <div className="grid h-[calc(100%-52px)] grid-rows-[1fr_16rem]">
        <div className="grid min-h-0 grid-cols-[1fr_20rem]">
          <WorkflowCanvas isDark={isDark} />
          <NodeConfigPanel webhookUrl={webhookUrl} endOutput={execution?.final_output} />
        </div>
        <ExecutionPanel
          execution={execution}
          history={history}
          selectedRunId={execution?.run_id}
          onSelectRun={(runId) => {
            loadExecution(runId).catch((error) => showNotice("error", getErrorMessage(error)));
          }}
        />
      </div>
    </main>
  );
}
