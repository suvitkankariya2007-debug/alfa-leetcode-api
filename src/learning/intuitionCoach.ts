/**
 * Owner-scoped, intuition-first directions for algorithm problems.
 * This is an instant, deterministic coaching layer: it does not make an LLM
 * request, run user code, or claim to know an algorithm from verdict metadata.
 * Future multiuser deployments must load each owner's preferences separately.
 */
import { diagnoseTopics } from './diagnostics';
import type { LearningState } from './learningState';
import { knownCandidates, type Candidate } from './roadmap';

export type HintStage = 'orientation' | 'nudge' | 'deeper' | 'dry-run' | 'debug';

export interface DirectionRequest {
  problemKey?: string;
  topic?: string;
  stage?: HintStage;
}

interface Lens {
  name: string;
  recognition: string;
  observation: string;
  nudge: string;
  deeper: string;
  dryRun: string;
  debug: string;
  transferQuestion: string;
  tags: string[];
}

const LENSES: Record<string, Lens> = {
  'two-pointers': {
    name: 'Two pointers',
    recognition: 'Can two positions move in a predictable direction without losing valid candidates?',
    observation: 'Examine order, pairs and when it is safe to discard a candidate.',
    nudge: 'Try reasoning about the leftmost and rightmost remaining elements after sorting, where appropriate.',
    deeper: 'Write down the condition that justifies moving only one pointer, and prove what candidates are removed.',
    dryRun: 'Choose a tiny sorted input; record left, right, the relevant comparison and why either pointer moves.',
    debug: 'Check pointer movement after a match, duplicates, termination, and whether sorting changes needed information.',
    transferQuestion: 'Would the direction of pointer movement remain valid if the input were not sorted?',
    tags: ['two-pointers', 'sorting'],
  },
  'binary-search': {
    name: 'Binary search',
    recognition: 'Is there a monotonic boundary or yes/no decision that changes only once?',
    observation: 'Define what you are searching for before deciding the interval to shrink.',
    nudge: 'Write a boolean feasibility predicate for a proposed answer or index.',
    deeper: 'Specify whether the answer remains on the left or right when the predicate is true; establish an interval invariant.',
    dryRun: 'Track low, high, mid and predicate(mid) on a 5-element example until termination.',
    debug: 'Check monotonicity, inclusive versus exclusive bounds, mid updates, termination and off-by-one errors.',
    transferQuestion: 'Can you prove the predicate stays true on one side of a boundary?',
    tags: ['binary-search'],
  },
  'sliding-window': {
    name: 'Sliding window',
    recognition: 'Is the question about a contiguous range whose validity changes as a boundary moves?',
    observation: 'Find a condition that can be updated by adding or removing one element.',
    nudge: 'Think about when the right boundary grows and what invalidates the window.',
    deeper: 'Define the window invariant and when you may safely advance the left boundary.',
    dryRun: 'Track left, right, current window state and validity on a short input.',
    debug: 'Check whether negatives invalidate monotonic shrink logic, and whether updates happen before or after evaluation.',
    transferQuestion: 'Which property fails if you use the same window logic on arbitrary negative numbers?',
    tags: ['sliding-window'],
  },
  'prefix-sum': {
    name: 'Prefix sums',
    recognition: 'Does the question repeatedly ask about sums or differences of contiguous prefixes/ranges?',
    observation: 'Rewrite a range aggregate using prefix states.',
    nudge: 'Consider whether a previous prefix value lets you answer the current condition.',
    deeper: 'Derive the algebraic relation between the desired segment and two prefix values; track duplicates if counting.',
    dryRun: 'Make a table of index, running prefix, needed previous prefix and accumulated answer.',
    debug: 'Check the empty prefix, index conventions, repeated sums and negative values.',
    transferQuestion: 'Why can a two-pointer sum window fail where prefix sums still work?',
    tags: ['prefix-sum'],
  },
  'hash-table': {
    name: 'Hashing / frequency maps',
    recognition: 'Can you remember an earlier value or count so a future lookup avoids rescanning?',
    observation: 'Identify the exact value or frequency needed to complete a condition.',
    nudge: 'Express the complement or previously seen state in one equation.',
    deeper: 'Choose whether to update the map before or after checking for a match, and justify that ordering.',
    dryRun: 'Record current value, needed complement, map before update and map after update.',
    debug: 'Check accidental reuse of the same index, default counts and duplicate handling.',
    transferQuestion: 'What information must the map preserve to make each decision correct?',
    tags: ['hash-table'],
  },
  stack: {
    name: 'Stack / last unmatched state',
    recognition: 'Does the current element need to interact with the most recently unresolved element?',
    observation: 'Look for matching, nesting, or a last-in-first-out dependency.',
    nudge: 'Describe what one stack entry represents and when it becomes unnecessary.',
    deeper: 'Establish the invariant that every stack entry is unresolved and in the required order.',
    dryRun: 'Track the full stack after each symbol on a short balanced and unbalanced example.',
    debug: 'Check empty-stack access, premature closing symbols, leftover entries and matching types.',
    transferQuestion: 'What would a queue lose that a stack retains for nested structures?',
    tags: ['stack'],
  },
  recursion: {
    name: 'Recursion / tree states',
    recognition: 'Can the answer for a larger structure be built from answers to smaller, structurally similar parts?',
    observation: 'Define exactly what the recursive function promises to return.',
    nudge: 'State the smallest empty or single-node case and what information the parent needs.',
    deeper: 'Write an inductive contract: base case, recursive calls, and how returned values combine.',
    dryRun: 'Draw a tiny tree; track arguments, returns and which frame is currently active.',
    debug: 'Check premature return from only one branch, missing null handling and whether global constraints must be carried.',
    transferQuestion: 'Does inspecting just the immediate children prove a property of the entire subtree?',
    tags: ['recursion','tree'],
  },
  'dynamic-programming': {
    name: 'Dynamic programming',
    recognition: 'Do overlapping subproblems appear, and can the answer be represented by a small state?',
    observation: 'Describe what a state means before choosing memoization or tabulation.',
    nudge: 'List the decisions available at one state and how they change the next state.',
    deeper: 'Derive the transition, base cases and dependency order; then estimate state count and work per state.',
    dryRun: 'For the smallest inputs, fill a table of state, choices, dependencies and result.',
    debug: 'Check ambiguous state meaning, unreachable states, incorrect initialization and transition bounds.',
    transferQuestion: 'What information from the past is actually necessary to make the next optimal choice?',
    tags: ['dynamic-programming'],
  },
  graph: {
    name: 'Graph search',
    recognition: 'Can you model the problem as states connected by permitted transitions?',
    observation: 'Define a node/state, its neighbors and the goal or invariant.',
    nudge: 'Decide whether you need reachability, shortest unweighted distance or full exploration.',
    deeper: 'Choose BFS for increasing unweighted distance layers or DFS for exploration; justify visited-state timing.',
    dryRun: 'Track a tiny frontier/queue or DFS stack, visited states and parent transitions.',
    debug: 'Check revisiting nodes, wrong neighbor generation and whether edges are weighted.',
    transferQuestion: 'How would your strategy change if every edge had a different cost?',
    tags: ['graph','bfs','dfs'],
  },
  'sorting': {
    name: 'Sort to expose structure',
    recognition: 'Would ordering values make a local decision or global relation easier to prove?',
    observation: 'Ask what information is gained and lost by rearranging the input.',
    nudge: 'After sorting, look for neighboring relations, duplicates, or monotonic movement.',
    deeper: 'State a sorted-order invariant and account for the sort cost and original-index requirements.',
    dryRun: 'Write original and sorted inputs; explain what candidates can now be skipped.',
    debug: 'Check original-position requirements, equal-value cases and comparator correctness.',
    transferQuestion: 'Does sorting simplify the problem enough to compensate for its extra time?',
    tags: ['sorting'],
  },
};

const ALIASES: Record<string, string> = {
  'two-pointer': 'two-pointers', 'two-pointers': 'two-pointers',
  'binary-search': 'binary-search', 'binarysearch': 'binary-search',
  'sliding-window': 'sliding-window', 'window': 'sliding-window',
  'prefix-sums': 'prefix-sum', 'prefix-sum': 'prefix-sum',
  'hashing': 'hash-table', 'hash-map': 'hash-table', 'hash-table': 'hash-table',
  'stack': 'stack', 'monotonic-stack': 'stack',
  'recursion': 'recursion', 'tree': 'recursion', 'dfs': 'graph',
  'bfs': 'graph', 'graph': 'graph', 'graphs': 'graph',
  'dp': 'dynamic-programming', 'dynamic-programming': 'dynamic-programming',
  'sorting': 'sorting', 'sort': 'sorting',
};

function canonical(input: string): string | null {
  const value = input.trim().toLowerCase().replace(/[_\s]+/g, '-');
  return Object.prototype.hasOwnProperty.call(ALIASES, value) ? ALIASES[value] : null;
}

export interface NextTransfer {
  problemKey: string;
  title: string;
  url: string;
  reason: string;
  source: 'maintained_starter_catalog';
}
export interface IntuitionDirection {
  goal: 'build_transferable_problem_solving_intuition';
  match: { problemKey: string | null; topic: string | null; basis: 'catalog' | 'explicit_topic' | 'insufficient_information' };
  stage: HintStage;
  prompt: string;
  hints: string[];
  learnerAction: string;
  progressEvidence: string[];
  followUpProblems: NextTransfer[];
  teachingStyle: string[];
  limitations: string[];
}

const COACHING_DEFAULTS = [
  'Start with the property or pattern, not the finished algorithm.',
  'Ask for the learner\'s own hypothesis and a hand-traced small example.',
  'Increase hint strength only on request; use C++ when code is subsequently requested.',
  'When debugging, identify the reasoning mistake first, then show the correction.',
];

export function getIntuitionDirection(state: LearningState, request: DirectionRequest): IntuitionDirection {
  const stage = request.stage ?? 'orientation';
  const catalog = knownCandidates();
  const match: Candidate | undefined = request.problemKey
    ? catalog.find((candidate) => candidate.key === request.problemKey) : undefined;
  const explicit = request.topic ? canonical(request.topic) : null;
  const fromCatalog = match?.tags.map(canonical).find((topic): topic is string => Boolean(topic)) ?? null;
  const topic = explicit ?? fromCatalog;
  const basis: IntuitionDirection['match']['basis'] = explicit ? 'explicit_topic' : fromCatalog ? 'catalog' : 'insufficient_information';
  const lens = topic ? LENSES[topic] : undefined;
  const guidance = lens ? ({
    orientation: [lens.recognition, lens.observation],
    nudge: [lens.recognition, lens.nudge],
    deeper: [lens.deeper, lens.transferQuestion],
    'dry-run': [lens.dryRun],
    debug: [lens.debug],
  } satisfies Record<HintStage, string[]>)[stage] : [
    'Describe the input, the requested output, and the size constraints.',
    'What changes as you move through a small example, and what must remain true?',
  ];
  const diagnostics = diagnoseTopics(state);
  const evidence = lens ? diagnostics.filter((d) =>
    d.topic === topic || lens.tags.includes(d.topic)).slice(0, 2) : [];
  const progressEvidence = evidence.map((d) =>
    `${d.topic}: ${d.observedProblems} observed problem(s), ${d.acceptedProblems} accepted, ${d.submissions} recorded submission(s); confidence ${d.confidence}; priority ${d.priority}.`,
  );
  if (!progressEvidence.length) progressEvidence.push(
    'No trustworthy topic-specific attempt evidence is saved yet; this direction is based on a general pattern, not verified personal mastery.',
  );
  const excluded = new Set(
    Object.entries(state.problems).filter(([, p]) => p.accepted).map(([key]) => key),
  );
  for (const r of Object.values(state.recommendations)) {
    if (['completed','skipped','started'].includes(r.status)) excluded.add(r.problemKey);
  }
  const followUpProblems = lens ? catalog.filter((candidate) => candidate.key !== match?.key &&
    !excluded.has(candidate.key) && candidate.tags.some((tag) => lens.tags.includes(tag)))
    .slice(0, 3)
    .map((candidate) => ({
      problemKey: candidate.key,
      title: candidate.title,
      url: candidate.url,
      reason: 'A related practice candidate for transferring the ' + lens.name + ' idea; solved status may be incomplete.',
      source: 'maintained_starter_catalog' as const,
    })) : [];
  return {
    goal: 'build_transferable_problem_solving_intuition',
    match: { problemKey: match?.key ?? null, topic: topic ?? null, basis },
    stage, prompt: match ? 'Explore the reasoning behind ' + match.title + ' without spoiling a complete solution.'
      : lens ? 'Explore ' + lens.name + ' by discovering its invariant and where it applies.'
      : 'Describe the problem type or provide a known problem key so I can give more specific guidance.',
    hints: guidance,
    learnerAction: lens
      ? stage === 'dry-run' ? 'Write your own variable-by-variable trace and explain where the invariant is maintained.'
      : stage === 'debug' ? 'Show your attempted code and the smallest failing input; do not replace the entire solution yet.'
      : 'State one candidate approach, why it might work, and a counterexample that could break it.'
      : 'Share the problem constraints and one small example; first try to identify its changing state.',
    progressEvidence, followUpProblems,
    teachingStyle: COACHING_DEFAULTS,
    limitations: [
      'No LLM, online-judge source access, or arbitrary code execution is used by this immediate guidance tool.',
      'One catalog tag is a learning direction, not proof it is the only or optimal solution.',
      'Public activity history is incomplete; recommendations are not guaranteed unsolved.',
      'Full code-aware critique requires reading actual authorized source code.',
    ],
  };
}
