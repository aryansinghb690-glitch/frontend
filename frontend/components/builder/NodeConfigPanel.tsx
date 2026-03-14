"use client";

import React, { useEffect, useMemo, useState } from "react";

import { useWorkflowStore } from "@/lib/store/workflow-store";

type Props = {
  webhookUrl?: string;
  endOutput?: Record<string, unknown>;
};

function collectObjectPaths(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const keys: string[] = [];

  for (const [key, child] of entries) {
    const path = prefix ? `${prefix}.${key}` : key;
    keys.push(path);
    if (child && typeof child === "object" && !Array.isArray(child)) {
      keys.push(...collectObjectPaths(child, path));
    }
  }

  return keys;
}

function collectObjectPathTypes(value: unknown, prefix = ""): Array<{ path: string; type: string }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const keys: Array<{ path: string; type: string }> = [];

  for (const [key, child] of entries) {
    const path = prefix ? `${prefix}.${key}` : key;
    const type = Array.isArray(child) ? "array" : child === null ? "null" : typeof child;
    keys.push({ path, type });
    if (child && typeof child === "object" && !Array.isArray(child)) {
      keys.push(...collectObjectPathTypes(child, path));
    }
  }

  return keys;
}

function formatOutput(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function getNodeTypeTitle(type: string): string {
  if (type === "manual_trigger") return "Manual Trigger";
  if (type === "webhook_trigger") return "Webhook Trigger";
  if (type === "http_request") return "HTTP Request";
  if (type === "transform_data") return "Transform Data";
  if (type === "decision") return "Decision";
  if (type === "wait") return "Wait";
  if (type === "end") return "End";
  return type;
}

export function NodeConfigPanel({ webhookUrl, endOutput }: Props): React.ReactElement {
  const nodes = useWorkflowStore((s) => s.nodes);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const updateSelectedNodeLabel = useWorkflowStore((s) => s.updateSelectedNodeLabel);
  const updateSelectedNodeConfig = useWorkflowStore((s) => s.updateSelectedNodeConfig);

  const node = useMemo(() => nodes.find((n) => n.id === selectedNodeId), [nodes, selectedNodeId]);
  const inputKeyTypeMap = useMemo(() => {
    const keys = new Map<string, string>();

    for (const workflowNode of nodes) {
      const config = workflowNode.data.config || {};

      if (workflowNode.data.type === "manual_trigger") {
        for (const item of collectObjectPathTypes(config.initial_payload)) {
          keys.set(item.path, item.type);
        }
      }

      if (workflowNode.data.type === "webhook_trigger") {
        for (const item of collectObjectPathTypes(config.payload_schema)) {
          keys.set(item.path, item.type);
        }
      }
    }

    return keys;
  }, [nodes]);
  // Keep this payload box synced when selected node flips, so UI doesnt feel weird.
  const [payloadText, setPayloadText] = useState(() => JSON.stringify(node?.data.config?.initial_payload || {}, null, 2));
  const [headersText, setHeadersText] = useState(() => JSON.stringify(node?.data.config?.headers || {}, null, 2));
  const [bodyTemplateText, setBodyTemplateText] = useState(() => {
    const bodyTemplate = node?.data.config?.body_template;
    return bodyTemplate == null ? "" : JSON.stringify(bodyTemplate, null, 2);
  });
  const [payloadSchemaText, setPayloadSchemaText] = useState(() => {
    const payloadSchema = node?.data.config?.payload_schema;
    return payloadSchema == null ? "" : JSON.stringify(payloadSchema, null, 2);
  });
  const [parametersText, setParametersText] = useState(() => JSON.stringify(node?.data.config?.parameters || {}, null, 2));
  const [nodeLabelText, setNodeLabelText] = useState(() => String(node?.data.label || ""));
  useEffect(() => {
    setPayloadText(JSON.stringify(node?.data.config?.initial_payload || {}, null, 2));
  }, [node?.id, node?.data.config?.initial_payload]);
  useEffect(() => {
    setHeadersText(JSON.stringify(node?.data.config?.headers || {}, null, 2));
  }, [node?.id, node?.data.config?.headers]);
  useEffect(() => {
    const bodyTemplate = node?.data.config?.body_template;
    setBodyTemplateText(bodyTemplate == null ? "" : JSON.stringify(bodyTemplate, null, 2));
  }, [node?.id, node?.data.config?.body_template]);
  useEffect(() => {
    const payloadSchema = node?.data.config?.payload_schema;
    setPayloadSchemaText(payloadSchema == null ? "" : JSON.stringify(payloadSchema, null, 2));
  }, [node?.id, node?.data.config?.payload_schema]);
  useEffect(() => {
    setParametersText(JSON.stringify(node?.data.config?.parameters || {}, null, 2));
  }, [node?.id, node?.data.config?.parameters]);
  useEffect(() => {
    setNodeLabelText(String(node?.data.label || ""));
  }, [node?.id, node?.data.label]);

  const cfg = node?.data.config || {};
  const update = (key: string, value: unknown) => updateSelectedNodeConfig({ [key]: value });
  const supportsRetryPolicy = node?.data.type !== "wait";
  const retryPolicy =
    cfg.retry_policy && typeof cfg.retry_policy === "object" && !Array.isArray(cfg.retry_policy)
      ? (cfg.retry_policy as Record<string, unknown>)
      : {};
  const getRetryNumber = (key: "initial_interval_seconds" | "maximum_attempts", fallback: number): number => {
    const value = retryPolicy[key];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  };
  const setRetryPolicyField = (key: "initial_interval_seconds" | "maximum_attempts", value: number) => {
    update("retry_policy", {
      ...retryPolicy,
      [key]: value,
    });
  };
  const transformParameters = (cfg.parameters && typeof cfg.parameters === "object" && !Array.isArray(cfg.parameters)
    ? (cfg.parameters as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const getTransformParam = (key: string, fallback: unknown) => {
    if (transformParameters[key] !== undefined) {
      return transformParameters[key];
    }
    if ((cfg as Record<string, unknown>)[key] !== undefined) {
      return (cfg as Record<string, unknown>)[key];
    }
    return fallback;
  };
  const setTransformParam = (key: string, value: unknown) => {
    updateSelectedNodeConfig({
      [key]: value,
      parameters: {
        ...transformParameters,
        [key]: value,
      },
    });
  };
  const transformType = String(cfg.transform_type || "uppercase");
  const normalizeTransformParameters = (type: string, raw: Record<string, unknown>) => {
    if (type === "append_text") {
      return {
        mode: String(raw.mode ?? "append"),
        text: String(raw.text ?? ""),
      };
    }
    if (type === "multiply_numeric") {
      return {
        factor: Number(raw.factor ?? 1),
      };
    }
    if (type === "rename_key") {
      return {
        new_key: String(raw.new_key ?? ""),
      };
    }
    if (type === "extract_key") {
      return {
        extract_as: String(raw.extract_as ?? ""),
      };
    }
    return {};
  };
  const inputKeyOptions = useMemo(() => {
    const stringOnlyTransforms = new Set(["append_text", "uppercase"]);
    const numericOnlyTransforms = new Set(["multiply_numeric"]);
    const requiresStringKey = stringOnlyTransforms.has(transformType);
    const requiresNumericKey = numericOnlyTransforms.has(transformType);
    const requiresTypedKey = requiresStringKey || requiresNumericKey;
    const options = Array.from(inputKeyTypeMap.entries())
      .filter(([, type]) => {
        if (requiresStringKey) {
          return type === "string";
        }
        if (requiresNumericKey) {
          return type === "number";
        }
        return true;
      })
      .map(([key]) => key);

    const selectedField = String(cfg.target_field || "").trim();
    if (selectedField && !options.includes(selectedField) && !requiresTypedKey) {
      options.push(selectedField);
    }

    return options.sort((a, b) => a.localeCompare(b));
  }, [inputKeyTypeMap, transformType, cfg.target_field]);
  const decisionFieldOptions = useMemo(() => {
    const options = Array.from(inputKeyTypeMap.keys());
    const selectedField = String(cfg.field || "").trim();
    if (selectedField && !options.includes(selectedField)) {
      options.push(selectedField);
    }
    return options.sort((a, b) => a.localeCompare(b));
  }, [inputKeyTypeMap, cfg.field]);
  const handleTransformTypeChange = (nextType: string) => {
    const nextParameters = normalizeTransformParameters(nextType, transformParameters);
    updateSelectedNodeConfig({
      transform_type: nextType,
      target_field: cfg.target_field || "",
      extract_as: nextType === "extract_key" ? "" : cfg.extract_as,
      parameters: nextParameters,
    });
    setParametersText(JSON.stringify(nextParameters, null, 2));
  };

  if (!node) {
    return <div className="w-80 border-l border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-800">Select a node to configure it.</div>;
  }

  return (
    <div className="w-80 overflow-y-auto border-l border-slate-200 p-3 text-xs dark:border-slate-800">
      <h3 className="mb-3 text-sm font-semibold">{getNodeTypeTitle(node.data.type)} Config</h3>

      <div className="mb-3 space-y-1">
        <label className="block">Node name</label>
        <input
          className="w-full rounded border p-2"
          value={nodeLabelText}
          onChange={(e) => setNodeLabelText(e.currentTarget.value)}
          onBlur={() => {
            const nextLabel = nodeLabelText.trim();
            if (!nextLabel) {
              setNodeLabelText(node.data.label);
              return;
            }
            if (nextLabel !== node.data.label) {
              updateSelectedNodeLabel(nextLabel);
            }
          }}
        />
      </div>

      {node.data.type === "manual_trigger" && (
        <div className="space-y-2">
          <label className="block">Initial payload (JSON)</label>
          <textarea
            className="h-28 w-full rounded border p-2"
            value={payloadText}
            onChange={(e) => setPayloadText(e.currentTarget.value)}
            onBlur={(e) => {
              try {
                update("initial_payload", JSON.parse(e.currentTarget.value || "{}"));
              } catch {
                alert("Invalid JSON in payload");
              }
            }}
          />
        </div>
      )}

      {node.data.type === "webhook_trigger" && (
        <div className="space-y-2">
          <label className="block">Webhook URL</label>
          <input className="w-full rounded border p-2" value={webhookUrl || "Save workflow to generate URL"} readOnly />
          <label className="block">Payload schema (JSON, optional)</label>
          <textarea
            className="h-24 w-full rounded border p-2"
            value={payloadSchemaText}
            onChange={(e) => setPayloadSchemaText(e.currentTarget.value)}
            onBlur={(e) => {
              try {
                const nextValue = e.currentTarget.value.trim();
                update("payload_schema", nextValue ? JSON.parse(nextValue) : undefined);
              } catch {
                alert("Invalid JSON in webhook payload schema");
              }
            }}
          />
        </div>
      )}

      {node.data.type === "http_request" && (
        <div className="space-y-2">
          <label className="block">Method</label>
          <select className="w-full rounded border p-2" value={String(cfg.method || "GET")} onChange={(e) => update("method", e.currentTarget.value)}>
            <option>GET</option>
            <option>POST</option>
          </select>
          <label className="block">URL</label>
          <input className="w-full rounded border p-2" value={String(cfg.url || "")} onChange={(e) => update("url", e.currentTarget.value)} />
          <label className="block">Headers (JSON, optional)</label>
          <textarea
            className="h-24 w-full rounded border p-2"
            value={headersText}
            onChange={(e) => setHeadersText(e.currentTarget.value)}
            onBlur={(e) => {
              try {
                update("headers", JSON.parse(e.currentTarget.value || "{}"));
              } catch {
                alert("Invalid JSON in headers");
              }
            }}
          />
          <label className="block">Request body template (JSON, optional)</label>
          <textarea
            className="h-24 w-full rounded border p-2"
            value={bodyTemplateText}
            onChange={(e) => setBodyTemplateText(e.currentTarget.value)}
            onBlur={(e) => {
              try {
                const nextValue = e.currentTarget.value.trim();
                update("body_template", nextValue ? JSON.parse(nextValue) : undefined);
              } catch {
                alert("Invalid JSON in request body template");
              }
            }}
          />
        </div>
      )}

      {node.data.type === "transform_data" && (
        <div className="space-y-2">
          <label className="block">Transform type</label>
          <select className="w-full rounded border p-2" value={transformType} onChange={(e) => handleTransformTypeChange(e.currentTarget.value)}>
            <option value="uppercase">uppercase</option>
            <option value="append_text">append/prepend text</option>
            <option value="multiply_numeric">multiply numeric</option>
            <option value="rename_key">replace value</option>
            <option value="extract_key">extract key</option>
          </select>
          <label className="block">Target field</label>
          <input
            className="w-full rounded border p-2"
            value={String(cfg.target_field || "")}
            onChange={(e) => update("target_field", e.currentTarget.value)}
            placeholder="e.g. count or user.profile.name"
          />
          {inputKeyOptions.length > 0 && <p className="text-[11px] text-slate-400">Detected input keys: {inputKeyOptions.join(", ")}</p>}

          {transformType === "append_text" && (
            <>
              <label className="block">Mode</label>
              <select className="w-full rounded border p-2" value={String(getTransformParam("mode", "append"))} onChange={(e) => setTransformParam("mode", e.currentTarget.value)}>
                <option value="append">append</option>
                <option value="prepend">prepend</option>
              </select>
              <label className="block">Text</label>
              <input className="w-full rounded border p-2" value={String(getTransformParam("text", ""))} onChange={(e) => setTransformParam("text", e.currentTarget.value)} />
            </>
          )}

          {transformType === "multiply_numeric" && (
            <>
              <label className="block">Factor</label>
              <input type="number" className="w-full rounded border p-2" value={Number(getTransformParam("factor", 1))} onChange={(e) => setTransformParam("factor", Number(e.currentTarget.value))} />
            </>
          )}

          {transformType === "rename_key" && (
            <>
              <label className="block">New value</label>
              <p className="text-[11px] text-slate-400">Replaces the current value of the target field.</p>
              <input className="w-full rounded border p-2" value={String(getTransformParam("new_key", ""))} onChange={(e) => setTransformParam("new_key", e.currentTarget.value)} />
            </>
          )}

          {transformType === "extract_key" && (
            <>
              <label className="block">Output key (optional)</label>
              <p className="text-[11px] text-slate-400">Leave empty to keep the extracted field name.</p>
              <input className="w-full rounded border p-2" value={String(getTransformParam("extract_as", ""))} onChange={(e) => setTransformParam("extract_as", e.currentTarget.value)} />
            </>
          )}

          <label className="block">Parameters (JSON)</label>
          <textarea
            className="h-24 w-full rounded border p-2"
            value={parametersText}
            onChange={(e) => setParametersText(e.currentTarget.value)}
            onBlur={(e) => {
              try {
                const parsed = JSON.parse(e.currentTarget.value || "{}");
                if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                  throw new Error("invalid");
                }
                update("parameters", parsed);
              } catch {
                alert("Invalid JSON in transform parameters");
              }
            }}
          />
          
        </div>
      )}

      {node.data.type === "decision" && (
        <div className="space-y-2">
          <label className="block">Field</label>
          <input
            className="w-full rounded border p-2"
            value={String(cfg.field || "")}
            onChange={(e) => update("field", e.currentTarget.value)}
            placeholder="e.g. count or api_responses.httpqa_response_1.status"
          />
          {decisionFieldOptions.length > 0 && <p className="text-[11px] text-slate-400">Detected input keys: {decisionFieldOptions.join(", ")}</p>}
          <label className="block">Operator</label>
          <select className="w-full rounded border p-2" value={String(cfg.operator || "equals")} onChange={(e) => update("operator", e.currentTarget.value)}>
            <option value="equals">equals</option>
            <option value="not_equals">not_equals</option>
            <option value="greater_than">greater_than</option>
            <option value="less_than">less_than</option>
            <option value="contains">contains</option>
            <option value="is_empty">is_empty</option>
          </select>
          <label className="block">Value</label>
          <input className="w-full rounded border p-2" value={String(cfg.value || "")} onChange={(e) => update("value", e.currentTarget.value)} />
        </div>
      )}

      {node.data.type === "wait" && (
        <div className="space-y-2">
          <label className="block">Duration</label>
          <input type="number" className="w-full rounded border p-2" value={Number(cfg.duration || 30)} onChange={(e) => update("duration", Number(e.currentTarget.value))} />
          <label className="block">Unit</label>
          <select className="w-full rounded border p-2" value={String(cfg.unit || "seconds")} onChange={(e) => update("unit", e.currentTarget.value)}>
            <option value="seconds">seconds</option>
            <option value="minutes">minutes</option>
          </select>
        </div>
      )}

      {node.data.type === "end" && (
        <div className="space-y-2">
          <label className="block">Final output (read-only)</label>
          <pre className="max-h-60 overflow-auto rounded border bg-slate-50 p-2 text-[11px] dark:bg-slate-950">{formatOutput(endOutput || {})}</pre>
        </div>
      )}

      {supportsRetryPolicy && (
        <div className="mt-4 space-y-2 border-t pt-3">
          <h4 className="text-xs font-semibold">Temporal Retry Policy</h4>
          <label className="block">Initial interval (seconds)</label>
          <input
            type="number"
            min={0.1}
            step={0.1}
            className="w-full rounded border p-2"
            value={getRetryNumber("initial_interval_seconds", node.data.type === "decision" ? 1 : 2)}
            onChange={(e) => setRetryPolicyField("initial_interval_seconds", Number(e.currentTarget.value))}
          />
          <label className="block">Maximum attempts</label>
          <input
            type="number"
            min={1}
            step={1}
            className="w-full rounded border p-2"
            value={getRetryNumber("maximum_attempts", node.data.type === "decision" ? 2 : 3)}
            onChange={(e) => setRetryPolicyField("maximum_attempts", Math.max(1, Number(e.currentTarget.value) || 1))}
          />
        </div>
      )}

    </div>
  );
}
