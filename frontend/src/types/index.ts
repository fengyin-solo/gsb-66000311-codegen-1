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

/** 保存用例时的完整快照：正则、测试文本、关注步骤与匹配结果 */
export interface CaseSnapshot {
  pattern: string
  testString: string
  /** 保存时关注（播放停留）的步骤 */
  currentStep: number
  result: MatchResult
}

/** 最近用例列表中的一条记录 */
export interface SavedCase extends CaseSnapshot {
  id: string
  /** 保存时间（毫秒时间戳），列表按此倒序排列 */
  savedAt: number
}

/** 最后一次会话指针：指向某条已保存用例 */
export interface SessionSnapshot {
  caseId: string
  savedAt: number
}

export type CaseMessageType = 'success' | 'error' | 'info'

export interface CaseMessage {
  type: CaseMessageType
  text: string
}
