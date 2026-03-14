import { Edge, Node, XYPosition } from "@xyflow/react";

export type NodeType =
  | "manual_trigger"
  | "webhook_trigger"
  | "http_request"
  | "transform_data"
  | "decision"
  | "wait"
  | "end";

export type WorkflowNodeData = {
  type: NodeType;
  label: string;
  config: Record<string, unknown>;
};

export type WorkflowNode = Node<WorkflowNodeData>;
export type WorkflowEdge = Edge;

export type PersistedNode = {
  id: string;
  type: NodeType;
  label?: string | null;
  config: Record<string, unknown>;
  position: XYPosition;
};

export type PersistedEdge = {
  id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle?: string | null;
};

export type WorkflowGraph = {
  nodes: PersistedNode[];
  edges: PersistedEdge[];
};

export type WorkflowDto = {
  workflow_id: string;
  name: string;
  graph: WorkflowGraph;
  created_at: string;
  updated_at: string;
};

export type ValidationErrorItem = {
  code: string;
  message: string;
  node_id: string | null;
  details?: unknown;
};

export class ValidationError extends Error {
  readonly errors: ValidationErrorItem[];
  constructor(errors: ValidationErrorItem[]) {
    super("Validation failed");
    this.name = "ValidationError";
    this.errors = errors;
  }
}

export type ExecutionLog = {
  step: number;
  node_id: string;
  node_type: string;
  status: string;
  message: string;
  output?: Record<string, unknown>;
};

export type ExecutionDto = {
  run_id: string;
  workflow_id: string;
  trigger_type: string;
  status: string;
  current_node_id?: string;
  current_node_type?: string;
  logs: ExecutionLog[];
  final_output?: Record<string, unknown>;
  error?: string;
  started_at: string;
  finished_at?: string;
};
