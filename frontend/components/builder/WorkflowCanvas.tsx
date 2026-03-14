"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  Background,
  Connection,
  Controls,
  IsValidConnection,
  MiniMap,
  OnEdgesChange,
  OnNodesChange,
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from "@xyflow/react";

import { DecisionNode } from "@/components/builder/DecisionNode";
import { NODE_LIBRARY } from "@/components/builder/node-defs";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import { WorkflowEdge, WorkflowNode } from "@/types/workflow";

const nodeTypes = {
  decisionNode: DecisionNode,
};

type Props = {
  isDark?: boolean;
};

export function WorkflowCanvas({ isDark = false }: Props) {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const setNodes = useWorkflowStore((s) => s.setNodes);
  const setNodesWithPreviousSnapshot = useWorkflowStore((s) => s.setNodesWithPreviousSnapshot);
  const setNodesSilent = useWorkflowStore((s) => s.setNodesSilent);
  const setEdges = useWorkflowStore((s) => s.setEdges);
  const setEdgesSilent = useWorkflowStore((s) => s.setEdgesSilent);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const dragStartNodesRef = useRef<WorkflowNode[] | null>(null);

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const onNodesChange: OnNodesChange<WorkflowNode> = useCallback(
    (changes) => {
      const applied = applyNodeChanges<WorkflowNode>(changes, nodes);
      const hasDragMove = changes.some((c) => c.type === "position" && c.dragging === true);
      const hasDragEnd = changes.some((c) => c.type === "position" && c.dragging === false);
      const hasRemove = changes.some((c) => c.type === "remove");

      if (hasDragMove && !dragStartNodesRef.current) {
        dragStartNodesRef.current = structuredClone(nodes);
      }

      if (hasDragEnd && dragStartNodesRef.current) {
        setNodesWithPreviousSnapshot(dragStartNodesRef.current, applied);
        dragStartNodesRef.current = null;
        return;
      }

      if (hasRemove) {
        setNodes(applied);
      } else {
        setNodesSilent(applied);
      }
    },
    [nodes, setNodes, setNodesSilent, setNodesWithPreviousSnapshot]
  );

  const onEdgesChange: OnEdgesChange<WorkflowEdge> = useCallback(
    (changes) => {
      const applied = applyEdgeChanges<WorkflowEdge>(changes, edges);
      const isHistoryWorthy = changes.some((c) => c.type === "remove");
      if (isHistoryWorthy) {
        setEdges(applied);
      } else {
        setEdgesSilent(applied);
      }
    },
    [edges, setEdges, setEdgesSilent]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceNode = connection.source ? nodeById.get(connection.source) : undefined;
      const targetNode = connection.target ? nodeById.get(connection.target) : undefined;
      if (!sourceNode || !targetNode) return;
      if (sourceNode.data.type === "end") return;
      if (targetNode.data.type === "manual_trigger" || targetNode.data.type === "webhook_trigger") return;
      if (sourceNode.data.type === "decision" && connection.sourceHandle !== "true" && connection.sourceHandle !== "false") return;

      const withLabel = {
        ...connection,
        label: connection.sourceHandle === "true" ? "True" : connection.sourceHandle === "false" ? "False" : undefined,
        animated: connection.sourceHandle === "true" || connection.sourceHandle === "false",
      };
      setEdges(addEdge(withLabel, edges));
    },
    [edges, nodeById, setEdges]
  );

  const isValidConnection: IsValidConnection<WorkflowEdge> = useCallback(
    (edgeOrConnection) => {
      const source = edgeOrConnection.source;
      const target = edgeOrConnection.target;
      const sourceHandle = edgeOrConnection.sourceHandle ?? null;

      if (!source || !target) return false;
      if (source === target) return false;

      const sourceNode = nodeById.get(source);
      const targetNode = nodeById.get(target);
      if (!sourceNode || !targetNode) return false;

      if (sourceNode.data.type === "end") return false;
      if (targetNode.data.type === "manual_trigger" || targetNode.data.type === "webhook_trigger") return false;

      if (sourceNode.data.type === "decision") {
        if (sourceHandle !== "true" && sourceHandle !== "false") {
          return false;
        }
        const alreadyConnectedBranch = edges.some(
          (edge) => edge.source === source && (edge.sourceHandle ?? null) === sourceHandle
        );
        if (alreadyConnectedBranch) {
          return false;
        }
      }

      const duplicateEdge = edges.some(
        (edge) =>
          edge.source === source &&
          edge.target === target &&
          (edge.sourceHandle ?? null) === sourceHandle
      );
      return !duplicateEdge;
    },
    [edges, nodeById]
  );

  const addNode = (type: (typeof NODE_LIBRARY)[number]["type"]) => {
    const nodeDef = NODE_LIBRARY.find((n) => n.type === type);
    if (!nodeDef) return;
    const nextNode = {
      id: `${type}-${crypto.randomUUID().slice(0, 6)}`,
      type: type === "decision" ? "decisionNode" : "default",
      position: { x: 120 + nodes.length * 15, y: 80 + nodes.length * 15 },
      data: {
        type,
        label: nodeDef.label,
        config: structuredClone(nodeDef.defaultConfig),
      },
    };
    useWorkflowStore.getState().addNode(nextNode);
  };

  const palette = useMemo(
    () => (
      <div className="w-60 border-r border-slate-200 p-3 dark:border-slate-800">
        <h2 className="mb-3 text-sm font-semibold">Node Palette</h2>
        <div className="space-y-2">
          {NODE_LIBRARY.map((node) => (
            <button
              key={node.type}
              onClick={() => addNode(node.type)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-left text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
            >
              {node.label}
            </button>
          ))}
        </div>
      </div>
    ),
    [nodes.length]
  );

  return (
    <div className="flex h-full min-h-0">
      {palette}
      <div className="flex-1">
        <ReactFlow<WorkflowNode, WorkflowEdge>
          colorMode={isDark ? "dark" : "light"}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onNodeClick={(_, node) => selectNode(node.id)}
          onPaneClick={() => selectNode(undefined)}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
