export interface NFAState {
  id: number
  isStart: boolean
  isAccept: boolean
  x: number
  y: number
}

export interface NFATransition {
  from: number
  to: number
  symbol: string | null // null = epsilon
  label: string
}

export interface NFA {
  states: NFAState[]
  transitions: NFATransition[]
  startState: number
  acceptStates: number[]
}

export interface MatchStep {
  stepIndex: number
  charIndex: number
  char: string
  currentState: number
  nextState: number
  transition: string
  isBacktrack: boolean
  isMatch: boolean
}

export interface MatchResult {
  matched: boolean
  matchText: string
  groups: string[]
  steps: MatchStep[]
  backtracks: number
  totalSteps: number
  duration: number
}

export interface RegexTemplate {
  name: string
  pattern: string
  description: string
  testString: string
  category: string
}

export interface ASTNode {
  type: 'char' | 'star' | 'plus' | 'question' | 'or' | 'concat' | 'group' | 'dot' | 'anchor' | 'charclass' | 'digit' | 'word' | 'space'
  value?: string
  children?: ASTNode[]
  groupIndex?: number
}

/** 已保存的测试用例：正则 + 测试文本 + 关注步骤 + 保存时的结果快照 */
export interface HistoryCase {
  id: string
  pattern: string
  testString: string
  currentStep: number
  savedAt: number
  matchResult: MatchResult | null
}

/** 会话快照：刷新/重新进入工作台时同步恢复 */
export interface SessionSnapshot {
  pattern: string
  testString: string
  currentStep: number
  matchResult: MatchResult | null
  historySnapshot: HistoryCase[]
  updatedAt: number
}

export interface SaveFeedback {
  type: 'success' | 'warn' | 'error'
  text: string
}
