// src/graph/state-graph.ts
//
// Typed LangGraph-style StateGraph engine.
//
// - Nodes are async functions that receive the current state and return a Partial<S>.
// - Reducers define how returned patches are merged onto the running state.
// - Edges control flow (static + conditional).
// - A compiled graph can be invoked, streamed, or resumed from a checkpointer.
//
// The engine is deliberately small (~300 lines) and has zero runtime deps outside
// of the project's logger + Checkpointer interface.
//
// Usage:
//   const graph = new StateGraph<TaskState>({ request: 'overwrite', plan: 'overwrite', steps: 'concat' })
//     .addNode('plan', planNode)
//     .addNode('execute', executeNode)
//     .setEntry('plan')
//     .addEdge('plan', 'execute')
//     .addConditionalEdge('execute', s => s.done ? END : 'execute')
//     .compile();
//   const out = await graph.invoke(initial, { threadId: 't1', checkpointer });

import { logger } from '../utils/logger';
import type { Checkpointer } from './checkpointer';

// ─── Public types ─────────────────────────────────────────────────────────────

/** Sentinel for terminal edges. */
export const END = '__end__' as const;
export type END = typeof END;

/** A node function: receive state, return a partial patch to merge. */
export type NodeFn<S> = (state: S) => Promise<Partial<S>>;

/** A reducer merges prev + next for a given field. */
export type Reducer<V> = (prev: V | undefined, next: V | undefined) => V;

/** Per-field reducer config. */
export type ReducerSpec<S> = {
  [K in keyof S]?: Reducer<S[K]> | 'overwrite' | 'concat' | 'merge';
};

/** Conditional-edge function: receives state, returns next node name (or END). */
export type ConditionFn<S> = (state: S) => string | END;

export interface InvokeOptions<S> {
  threadId?: string;
  checkpointer?: Checkpointer<S>;
  /** Max steps guard to prevent infinite loops. Default 100. */
  maxSteps?: number;
}

export interface StreamEvent<S> {
  node: string;
  state: S;
}

export interface CompiledGraph<S> {
  invoke(input: S, options?: InvokeOptions<S>): Promise<S>;
  stream(input: S, options?: InvokeOptions<S>): AsyncIterable<StreamEvent<S>>;
  resume(threadId: string, checkpointer: Checkpointer<S>, options?: InvokeOptions<S>): Promise<S>;
}

// ─── Built-in reducer helpers ────────────────────────────────────────────────

function reducerFor<V>(spec: Reducer<V> | 'overwrite' | 'concat' | 'merge' | undefined): Reducer<V> {
  if (typeof spec === 'function') return spec;
  switch (spec) {
    case 'concat':
      return (prev, next) => {
        if (next === undefined) return (prev ?? []) as unknown as V;
        if (prev === undefined) return next;
        if (Array.isArray(prev) && Array.isArray(next)) {
          return [...prev, ...next] as unknown as V;
        }
        return next;
      };
    case 'merge':
      return (prev, next) => {
        if (next === undefined) return prev as V;
        if (prev === undefined) return next;
        if (typeof prev === 'object' && typeof next === 'object' && prev !== null && next !== null) {
          return { ...(prev as object), ...(next as object) } as V;
        }
        return next;
      };
    case 'overwrite':
    default:
      return (prev, next) => (next === undefined ? (prev as V) : next);
  }
}

function mergeState<S>(prev: S, patch: Partial<S>, reducers: ReducerSpec<S>): S {
  const out: S = { ...prev };
  const keys = Object.keys(patch) as (keyof S)[];
  for (const key of keys) {
    const reducer = reducerFor<S[keyof S]>(reducers[key]);
    out[key] = reducer(prev[key], patch[key]);
  }
  return out;
}

// ─── StateGraph builder ──────────────────────────────────────────────────────

interface EdgeStatic {
  kind: 'static';
  to: string | END;
}

interface EdgeConditional<S> {
  kind: 'conditional';
  cond: ConditionFn<S>;
}

type Edge<S> = EdgeStatic | EdgeConditional<S>;

export class StateGraph<S extends object> {
  private readonly nodes = new Map<string, NodeFn<S>>();
  private readonly edges = new Map<string, Edge<S>>();
  private readonly reducers: ReducerSpec<S>;
  private entryNode: string | null = null;

  constructor(reducers: ReducerSpec<S> = {}) {
    this.reducers = reducers;
  }

  addNode(name: string, fn: NodeFn<S>): this {
    if (name === END) throw new Error(`Node name "${END}" is reserved`);
    if (this.nodes.has(name)) throw new Error(`Node already registered: ${name}`);
    this.nodes.set(name, fn);
    return this;
  }

  addEdge(from: string, to: string | END): this {
    if (!this.nodes.has(from)) throw new Error(`addEdge: unknown from-node "${from}"`);
    if (to !== END && !this.nodes.has(to)) {
      throw new Error(`addEdge: unknown to-node "${to}"`);
    }
    this.edges.set(from, { kind: 'static', to });
    return this;
  }

  addConditionalEdge(from: string, cond: ConditionFn<S>): this {
    if (!this.nodes.has(from)) throw new Error(`addConditionalEdge: unknown from-node "${from}"`);
    this.edges.set(from, { kind: 'conditional', cond });
    return this;
  }

  setEntry(name: string): this {
    if (!this.nodes.has(name)) throw new Error(`setEntry: unknown node "${name}"`);
    this.entryNode = name;
    return this;
  }

  compile(): CompiledGraph<S> {
    if (!this.entryNode) throw new Error('StateGraph: entry node not set (call setEntry)');
    const entry = this.entryNode;
    const nodes = this.nodes;
    const edges = this.edges;
    const reducers = this.reducers;

    const resolveNext = (current: string, state: S): string | END => {
      const edge = edges.get(current);
      if (!edge) return END; // no edge = terminal
      if (edge.kind === 'static') return edge.to;
      const next = edge.cond(state);
      if (next !== END && !nodes.has(next)) {
        throw new Error(`Conditional edge from "${current}" returned unknown node "${next}"`);
      }
      return next;
    };

    async function* run(
      input: S,
      options: InvokeOptions<S> = {},
      startNode: string = entry,
      startState?: S,
    ): AsyncGenerator<StreamEvent<S>, S, void> {
      const maxSteps = options.maxSteps ?? 100;
      const checkpointer = options.checkpointer;
      const threadId = options.threadId;

      let state: S = startState ?? input;
      let current: string | END = startNode;
      let step = 0;

      while (current !== END) {
        if (step++ >= maxSteps) {
          logger.warn('StateGraph', `Hit maxSteps=${maxSteps} on thread=${threadId ?? 'anon'}`);
          break;
        }

        const fn = nodes.get(current);
        if (!fn) throw new Error(`Unknown node during execution: ${current}`);

        logger.info('StateGraph', `→ node "${current}" (thread=${threadId ?? 'anon'}, step=${step})`);
        const patch = await fn(state);
        state = mergeState(state, patch, reducers);

        if (checkpointer && threadId) {
          try {
            await checkpointer.save(threadId, current, state);
          } catch (err) {
            logger.warn('StateGraph', 'checkpoint save failed', err instanceof Error ? err.message : err);
          }
        }

        yield { node: current, state };

        current = resolveNext(current, state);
      }

      logger.info('StateGraph', `✓ graph completed (thread=${threadId ?? 'anon'}, steps=${step})`);
      return state;
    }

    return {
      async invoke(input: S, options?: InvokeOptions<S>): Promise<S> {
        let final: S = input;
        const gen = run(input, options);
        for (;;) {
          const res = await gen.next();
          if (res.done) { final = res.value; break; }
          final = res.value.state;
        }
        return final;
      },

      stream(input: S, options?: InvokeOptions<S>): AsyncIterable<StreamEvent<S>> {
        return {
          [Symbol.asyncIterator]: () => run(input, options),
        };
      },

      async resume(threadId: string, checkpointer: Checkpointer<S>, options?: InvokeOptions<S>): Promise<S> {
        const latest = await checkpointer.loadLatest(threadId);
        if (!latest) throw new Error(`No checkpoint found for thread "${threadId}"`);

        // Resume = pick up at the edge AFTER the last saved node.
        const startCurrent = resolveNext(latest.nodeName, latest.state);
        if (startCurrent === END) {
          logger.info('StateGraph', `resume(${threadId}): already at END after "${latest.nodeName}"`);
          return latest.state;
        }

        logger.info(
          'StateGraph',
          `resume(${threadId}): last node "${latest.nodeName}" → continuing at "${startCurrent}"`,
        );

        const mergedOpts: InvokeOptions<S> = { ...options, threadId, checkpointer };
        let final: S = latest.state;
        const gen = run(latest.state, mergedOpts, startCurrent, latest.state);
        for (;;) {
          const res = await gen.next();
          if (res.done) { final = res.value; break; }
          final = res.value.state;
        }
        return final;
      },
    };
  }
}
