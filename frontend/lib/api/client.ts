import { ExecutionDto, WorkflowDto, WorkflowEdge, WorkflowNode } from "@/types/workflow";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

const jsonHeaders = { "Content-Type": "application/json" };

const RETRYABLE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const MAX_NETWORK_RETRIES = 2;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function getMethod(init?: RequestInit): string {
  return (init?.method || "GET").toUpperCase();
}

function shouldRetryNetworkError(init?: RequestInit): boolean {
  return RETRYABLE_METHODS.has(getMethod(init));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  let lastError: unknown;

  // Tiny retry loop, but only for the safer request types.
  for (let attempt = 0; attempt <= MAX_NETWORK_RETRIES; attempt++) {
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
          ...jsonHeaders,
          ...(init?.headers || {}),
        },
        cache: "no-store",
      });
      break;
    } catch (error) {
      lastError = error;
      const canRetry = shouldRetryNetworkError(init) && attempt < MAX_NETWORK_RETRIES;
      if (!canRetry) {
        throw new Error(`Unable to reach API at ${API_BASE}: ${toErrorMessage(error)}`);
      }
      await delay(300 * (attempt + 1));
    }
  }

  if (!response!) {
    throw new Error(`Unable to reach API at ${API_BASE}: ${toErrorMessage(lastError)}`);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const detail = errorBody?.detail;
    if (detail && Array.isArray(detail?.errors)) {
      const { ValidationError } = await import("@/types/workflow");
      throw new ValidationError(detail.errors);
    }
    throw new Error(detail ? JSON.stringify(detail) : `Request failed: ${response.status}`);
  }

  return response.json();
}

export function toBackendGraph(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  // React Flow shape isnt the same as backend shape, so we map it cleanly here.
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.data.type,
      label: node.data.label,
      config: node.data.config || {},
      position: node.position,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source_node_id: edge.source,
      target_node_id: edge.target,
      source_handle: edge.sourceHandle,
    })),
  };
}

export function fromBackendGraph(dto: WorkflowDto): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  // And this maps server data back into the UI-friendly node/edge format.
  return {
    nodes: dto.graph.nodes.map((node) => ({
      id: node.id,
      type: node.type === "decision" ? "decisionNode" : "default",
      position: node.position,
      data: {
        type: node.type,
        label: (node.label && node.label.trim()) || node.type.replaceAll("_", " "),
        config: node.config || {},
      },
    })),
    edges: dto.graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source_node_id,
      target: edge.target_node_id,
      sourceHandle: edge.source_handle || undefined,
      label: edge.source_handle === "true" ? "True" : edge.source_handle === "false" ? "False" : undefined,
      animated: edge.source_handle === "true" || edge.source_handle === "false",
    })),
  };
}

export const workflowApi = {
  create: (name: string, nodes: WorkflowNode[], edges: WorkflowEdge[]) =>
    api<WorkflowDto>(`/workflows`, {
      method: "POST",
      body: JSON.stringify({ name, graph: toBackendGraph(nodes, edges) }),
    }),

  update: (workflowId: string, name: string, nodes: WorkflowNode[], edges: WorkflowEdge[]) =>
    api<WorkflowDto>(`/workflows/${workflowId}`, {
      method: "PUT",
      body: JSON.stringify({ name, graph: toBackendGraph(nodes, edges) }),
    }),

  get: (workflowId: string) => api<WorkflowDto>(`/workflows/${workflowId}`),

  export: (workflowId: string) => api<Record<string, unknown>>(`/workflows/${workflowId}/export`),

  import: (payload: Record<string, unknown>) =>
    api<WorkflowDto>(`/workflows/import`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  run: (
    workflowId: string,
    payload: Record<string, unknown>,
    triggerType: "manual_trigger" | "webhook_trigger" = "manual_trigger",
    nodes?: WorkflowNode[],
    edges?: WorkflowEdge[]
  ) =>
    api<{ run_id: string }>(`/workflows/${workflowId}/run`, {
      method: "POST",
      body: JSON.stringify({
        payload,
        trigger_type: triggerType,
        graph: nodes && edges ? toBackendGraph(nodes, edges) : undefined,
      }),
    }),

  getExecution: (runId: string) => api<ExecutionDto>(`/executions/${runId}`),

  listExecutions: (workflowId: string) => api<Array<Record<string, unknown>>>(`/workflows/${workflowId}/executions`),
};
