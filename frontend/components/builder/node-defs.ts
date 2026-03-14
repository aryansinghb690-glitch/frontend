import { WorkflowNodeData } from "@/types/workflow";

export const NODE_LIBRARY: Array<{ type: WorkflowNodeData["type"]; label: string; defaultConfig: Record<string, unknown> }> = [
  { type: "manual_trigger", label: "Manual Trigger", defaultConfig: { initial_payload: {}, retry_policy: { initial_interval_seconds: 2, maximum_attempts: 3 } } },
  { type: "webhook_trigger", label: "Webhook Trigger", defaultConfig: { retry_policy: { initial_interval_seconds: 2, maximum_attempts: 3 } } },
  { type: "http_request", label: "HTTP Request", defaultConfig: { method: "GET", url: "", headers: {}, body_template: {}, retry_policy: { initial_interval_seconds: 2, maximum_attempts: 3 } } },
  { type: "transform_data", label: "Transform Data", defaultConfig: { transform_type: "uppercase", target_field: "", text: "", mode: "append", factor: 1, extract_as: "", parameters: { text: "", mode: "append", factor: 1, extract_as: "", new_key: "" }, retry_policy: { initial_interval_seconds: 2, maximum_attempts: 3 } } },
  { type: "decision", label: "Decision", defaultConfig: { field: "value", operator: "greater_than", value: 10, retry_policy: { initial_interval_seconds: 1, maximum_attempts: 2 } } },
  { type: "wait", label: "Wait", defaultConfig: { duration: 30, unit: "seconds" } },
  { type: "end", label: "End", defaultConfig: { retry_policy: { initial_interval_seconds: 2, maximum_attempts: 3 } } },
];
