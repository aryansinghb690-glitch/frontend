"use client";

import { create } from "zustand";

import { WorkflowEdge, WorkflowNode } from "@/types/workflow";

type Snapshot = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

type WorkflowState = {
  workflowId?: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId?: string;
  history: Snapshot[];
  future: Snapshot[];
  setWorkflowMeta: (id: string | undefined, name: string, metadata?: { createdAt?: string; updatedAt?: string }) => void;
  setGraph: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
  addNode: (node: WorkflowNode) => void;
  setNodes: (nodes: WorkflowNode[]) => void;
  setNodesWithPreviousSnapshot: (previousNodes: WorkflowNode[], nodes: WorkflowNode[]) => void;
  setNodesSilent: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
  setEdgesSilent: (edges: WorkflowEdge[]) => void;
  selectNode: (nodeId?: string) => void;
  updateSelectedNodeLabel: (label: string) => void;
  updateSelectedNodeConfig: (config: Record<string, unknown>) => void;
  clearWorkflow: () => void;
  undo: () => void;
  redo: () => void;
};

const clone = (nodes: WorkflowNode[], edges: WorkflowEdge[]): Snapshot => ({
  // Undo/redo gets wonky fast if we dont deep-clone the graph snapshots.
  nodes: structuredClone(nodes),
  edges: structuredClone(edges),
});

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  name: "Untitled Workflow",
  nodes: [],
  edges: [],
  history: [],
  future: [],
  setWorkflowMeta: (id, name, metadata) =>
    set({
      workflowId: id,
      name,
      createdAt: metadata?.createdAt,
      updatedAt: metadata?.updatedAt,
    }),
  setGraph: (nodes, edges) => set({ nodes, edges, history: [], future: [] }),
  addNode: (node) =>
    set((state) => ({
      history: [...state.history, clone(state.nodes, state.edges)],
      future: [],
      nodes: [...state.nodes, node],
    })),
  setNodes: (nodes) =>
    set((state) => ({
      history: [...state.history, clone(state.nodes, state.edges)],
      future: [],
      nodes,
    })),
  setNodesWithPreviousSnapshot: (previousNodes, nodes) =>
    set((state) => ({
      // Drag/update flows sometimes hand us the "before" nodes separate from the new ones.
      history: [...state.history, { nodes: structuredClone(previousNodes), edges: structuredClone(state.edges) }],
      future: [],
      nodes,
    })),
  setNodesSilent: (nodes) => set({ nodes }),
  setEdges: (edges) =>
    set((state) => ({
      history: [...state.history, clone(state.nodes, state.edges)],
      future: [],
      edges,
    })),
  setEdgesSilent: (edges) => set({ edges }),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  updateSelectedNodeLabel: (label) =>
    set((state) => {
      if (!state.selectedNodeId) return state;
      const nodes = state.nodes.map((node) =>
        node.id === state.selectedNodeId
          ? {
              ...node,
              data: { ...node.data, label },
            }
          : node
      );
      return {
        history: [...state.history, clone(state.nodes, state.edges)],
        future: [],
        nodes,
      };
    }),
  updateSelectedNodeConfig: (config) =>
    set((state) => {
      if (!state.selectedNodeId) return state;
      const nodes = state.nodes.map((node) =>
        node.id === state.selectedNodeId
          ? {
              ...node,
              data: { ...node.data, config: { ...(node.data.config || {}), ...config } },
            }
          : node
      );
      return {
        history: [...state.history, clone(state.nodes, state.edges)],
        future: [],
        nodes,
      };
    }),
  clearWorkflow: () =>
    set({ nodes: [], edges: [], selectedNodeId: undefined, history: [], future: [] }),
  undo: () => {
    const state = get();
    const previous = state.history[state.history.length - 1];
    if (!previous) return;
    set({
      nodes: previous.nodes,
      edges: previous.edges,
      history: state.history.slice(0, -1),
      future: [...state.future, clone(state.nodes, state.edges)],
    });
  },
  redo: () => {
    const state = get();
    const next = state.future[state.future.length - 1];
    if (!next) return;
    // Redo works like a tiny stack here, last thing undone comes back first.
    set({
      nodes: next.nodes,
      edges: next.edges,
      future: state.future.slice(0, -1),
      history: [...state.history, clone(state.nodes, state.edges)],
    });
  },
}));
