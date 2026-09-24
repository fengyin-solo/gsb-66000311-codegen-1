import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { NFA, MatchResult, MatchStep, RegexTemplate, ASTNode, SavedCase, CaseSnapshot, SessionSnapshot, CaseMessage } from '../types'
import { readJSON, writeJSON, removeKey, CASES_STORAGE_KEY, SESSION_STORAGE_KEY } from '../utils/storage'

const GROUP_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']

export const TEMPLATES: RegexTemplate[] = [
  { name: '邮箱地址', pattern: '^([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+)\\.([a-zA-Z]{2,})$', description: '匹配标准邮箱格式：用户名@域名.顶级域', testString: 'user@example.com admin@mail.org test.user+tag@sub.domain.co.uk', category: '常用' },
  { name: 'URL链接', pattern: '^(https?)://([^/:]+)(?::(\\d+))?(.*)$', description: '匹配HTTP/HTTPS URL：协议://主机:端口/路径', testString: 'https://www.example.com:8080/path/to/page http://localhost:3000/api', category: '常用' },
  { name: 'IPv4地址', pattern: '^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$', description: '匹配IPv4地址四段数字', testString: '192.168.1.1 10.0.0.1 255.255.255.0', category: '常用' },
  { name: '日期格式', pattern: '^(\\d{4})-(\\d{2})-(\\d{2})$', description: '匹配YYYY-MM-DD日期', testString: '2024-01-15 1999-12-31 2025-06-06', category: '常用' },
  { name: '手机号码', pattern: '^1[3-9]\\d{9}$', description: '匹配中国大陆手机号', testString: '13800138000 15912345678 18600000000', category: '常用' },
  { name: '身份证号', pattern: '^(\\d{6})(\\d{4})(\\d{2})(\\d{2})(\\d{3})([0-9Xx])$', description: '18位身份证：地区码+出生日期+顺序码+校验码', testString: '11010119900101001X 440304200512120039', category: '常用' },
  { name: '十六进制颜色', pattern: '^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$', description: '匹配#RGB或#RRGGBB格式', testString: '#FF5733 #abc #1A2B3C ff0000', category: '前端' },
  { name: '邮政编码', pattern: '^\\d{6}$', description: '6位中国邮编', testString: '100000 518000 200120', category: '常用' },
  { name: '浮点数', pattern: '^-?\\d+\\.\\d+$', description: '匹配带小数点的数字', testString: '3.14 -0.5 100.0', category: '数字' },
  { name: '科学计数法', pattern: '^-?\\d+(\\.\\d+)?[eE][+-]?\\d+$', description: '匹配科学计数法数字', testString: '1.5e10 -2.3E-4 6.022e23', category: '数字' },
  { name: 'MAC地址', pattern: '^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$', description: '匹配MAC地址XX:XX:XX:XX:XX:XX', testString: '00:1A:2B:3C:4D:5E AA-BB-CC-DD-EE-FF', category: '网络' },
  { name: 'UUID', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', description: '标准UUID格式', testString: '550e8400-e29b-41d4-a716-446655440000', category: '网络' },
  { name: 'QQ号', pattern: '^[1-9]\\d{4,10}$', description: '5-11位QQ号', testString: '12345 10000 1234567890', category: '常用' },
  { name: '密码强度', pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$', description: '至少8位含大小写字母数字特殊字符', testString: 'Passw0rd! Str0ng@Pass', category: '安全' },
  { name: '中文姓名', pattern: '^[\\u4e00-\\u9fa5]{2,4}$', description: '2-4位中文字符', testString: '张三 李世明 王小明', category: '常用' },
  { name: '车牌号', pattern: '^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤川青藏琼宁][A-Z][A-HJ-NP-Z0-9]{5}$', description: '中国车牌格式', testString: '京A12345 沪B6789X', category: '常用' },
  { name: 'HTML标签', pattern: '<(\\w+)(\\s[^>]*)?>(.*?)</\\1>', description: '匹配HTML开闭标签对', testString: '<div class="x">content</div> <span>text</span>', category: '前端' },
  { name: '文件扩展名', pattern: '^.+\\.(\\w+)$', description: '提取文件扩展名', testString: 'image.png doc.pdf index.html', category: '前端' },
  { name: '经纬度', pattern: '^(\\-?\\d{1,3}\\.\\d+)\\s*,\\s*(\\-?\\d{1,3}\\.\\d+)$', description: '匹配经纬度坐标', testString: '116.404,39.915 -73.9857,40.7484', category: '地理' },
  { name: '版本号', pattern: '^(\\d+)\\.(\\d+)\\.(\\d+)(?:-(\\w+))?$', description: '语义化版本号x.y.z-tag', testString: '1.0.0 2.3.1-beta 10.20.30', category: '常用' },
  { name: '时间格式', pattern: '^([01]?\\d|2[0-3]):([0-5]\\d)(?::([0-5]\\d))?$', description: 'HH:MM或HH:MM:SS', testString: '14:30 23:59:59 00:00', category: '常用' }
]

interface StateNode {
  id: number
  isAccept: boolean
  transitions: Map<string, number[]>
  epsilonTransitions: number[]
}

function buildNFA(pattern: string): { states: StateNode[]; startState: number; acceptStates: number[] } {
  const states: StateNode[] = []
  let stateCounter = 0
  let pos = 0
  let groupCount = 0

  function newState(): number {
    const id = stateCounter++
    states.push({ id, isAccept: false, transitions: new Map(), epsilonTransitions: [] })
    return id
  }

  function addTransition(from: number, symbol: string, to: number) {
    if (!states[from].transitions.has(symbol)) {
      states[from].transitions.set(symbol, [])
    }
    states[from].transitions.get(symbol)!.push(to)
  }

  function addEpsilon(from: number, to: number) {
    states[from].epsilonTransitions.push(to)
  }

  function parseCharClass(): (ch: string) => boolean {
    const negative = pattern[pos] === '^'
    if (negative) pos++
    const ranges: [string, string][] = []
    const chars: string[] = []
    while (pos < pattern.length && pattern[pos] !== ']') {
      if (pattern[pos + 1] === '-' && pattern[pos + 2] && pattern[pos + 2] !== ']') {
        ranges.push([pattern[pos], pattern[pos + 2]])
        pos += 3
      } else {
        chars.push(pattern[pos])
        pos++
      }
    }
    pos++ // skip ]
    return (ch: string) => {
      if (negative) {
        return !chars.includes(ch) && !ranges.some(([s, e]) => ch >= s && ch <= e)
      }
      return chars.includes(ch) || ranges.some(([s, e]) => ch >= s && ch <= e)
    }
  }

  function parseConcat(): [number, number] {
    let start = newState()
    let end = start
    while (pos < pattern.length && !['|', ')'].includes(pattern[pos])) {
      let segStart: number, segEnd: number
      const ch = pattern[pos]
      if (ch === '(') {
        pos++
        groupCount++
        if (pattern[pos] === '?') {
          pos++
          if (pattern[pos] === ':') { pos++; }
          const [s, e] = parseOr()
          segStart = s; segEnd = e
        } else {
          const [s, e] = parseOr()
          segStart = s; segEnd = e
        }
        pos++ // skip )
      } else if (ch === '[') {
        pos++
        segStart = newState()
        segEnd = newState()
        const matcher = parseCharClass()
        addTransition(segStart, '__class_' + segStart, segEnd)
        ;(states[segEnd] as any)._matcher = matcher
      } else if (ch === '.') {
        segStart = newState()
        segEnd = newState()
        addTransition(segStart, '__dot', segEnd)
        pos++
      } else if (ch === '\\') {
        pos++
        const escaped = pattern[pos]
        segStart = newState()
        segEnd = newState()
        if (escaped === 'd') addTransition(segStart, '__digit', segEnd)
        else if (escaped === 'w') addTransition(segStart, '__word', segEnd)
        else if (escaped === 's') addTransition(segStart, '__space', segEnd)
        else addTransition(segStart, escaped, segEnd)
        pos++
      } else if (ch === '^' || ch === '$') {
        segStart = newState()
        segEnd = segStart
        pos++
      } else {
        segStart = newState()
        segEnd = newState()
        addTransition(segStart, ch, segEnd)
        pos++
      }

      // Handle quantifiers
      while (pos < pattern.length && ['*', '+', '?', '{'].includes(pattern[pos])) {
        const q = pattern[pos]
        if (q === '{') {
          while (pos < pattern.length && pattern[pos] !== '}') pos++
          pos++
        } else {
          pos++
        }
        const qStart = newState()
        const qEnd = newState()
        addEpsilon(qStart, segStart)
        if (q === '*') { addEpsilon(qStart, qEnd); addEpsilon(segEnd, qEnd); addEpsilon(segEnd, segStart) }
        else if (q === '+') { addEpsilon(segEnd, qEnd); addEpsilon(segEnd, segStart) }
        else if (q === '?') { addEpsilon(qStart, qEnd); addEpsilon(segEnd, qEnd) }
        segStart = qStart; segEnd = qEnd
        if (pos < pattern.length && pattern[pos] === '?') pos++ // lazy
      }

      if (end !== segStart) addEpsilon(end, segStart)
      end = segEnd
    }
    return [start, end]
  }

  function parseOr(): [number, number] {
    const [s1, e1] = parseConcat()
    let start = s1, end = e1
    while (pos < pattern.length && pattern[pos] === '|') {
      pos++
      const [s2, e2] = parseConcat()
      const ns = newState(), ne = newState()
      addEpsilon(ns, start); addEpsilon(ns, s2)
      addEpsilon(end, ne); addEpsilon(e2, ne)
      start = ns; end = ne
    }
    return [start, end]
  }

  const [startState, acceptState] = parseOr()
  states[acceptState].isAccept = true
  return { states, startState, acceptStates: [acceptState] }
}

function epsilonClosure(states: StateNode[], stateId: number): Set<number> {
  const closure = new Set<number>([stateId])
  const stack = [stateId]
  while (stack.length) {
    const s = stack.pop()!
    for (const next of states[s].epsilonTransitions) {
      if (!closure.has(next)) {
        closure.add(next)
        stack.push(next)
      }
    }
  }
  return closure
}

function matchTransition(state: StateNode, symbol: string): number[] {
  const results: number[] = []
  for (const [sym, targets] of state.transitions) {
    if (sym === symbol) { results.push(...targets); continue }
    if (sym === '__dot' && symbol !== '\n') { results.push(...targets); continue }
    if (sym === '__digit' && /\d/.test(symbol)) { results.push(...targets); continue }
    if (sym === '__word' && /\w/.test(symbol)) { results.push(...targets); continue }
    if (sym === '__space' && /\s/.test(symbol)) { results.push(...targets); continue }
    if (sym.startsWith('__class_')) {
      const matcher = (state as any)._matcher
      if (matcher && matcher(symbol)) results.push(...targets)
    }
  }
  return results
}

function runMatch(states: StateNode[], startState: number, input: string): MatchResult {
  const steps: MatchStep[] = []
  let backtracks = 0
  let stepIndex = 0
  const startTime = performance.now()

  // Try to match from each position
  for (let startPos = 0; startPos <= input.length; startPos++) {
    let currentStates = Array.from(epsilonClosure(states, startState))
    let matched = false
    let matchEnd = startPos

    for (let i = startPos; i < input.length; i++) {
      const char = input[i]
      const nextStates: number[] = []
      const seen = new Set<number>()

      for (const s of currentStates) {
        const targets = matchTransition(states[s], char)
        for (const t of targets) {
          const closure = epsilonClosure(states, t)
          for (const c of closure) {
            if (!seen.has(c)) {
              seen.add(c)
              nextStates.push(c)
              steps.push({
                stepIndex: stepIndex++,
                charIndex: i,
                char,
                currentState: s,
                nextState: c,
                transition: char,
                isBacktrack: false,
                isMatch: true
              })
            }
          }
        }
      }

      if (nextStates.length === 0) {
        if (currentStates.some(s => states[s].isAccept)) { matched = true; matchEnd = i; break }
        backtracks++
        steps.push({
          stepIndex: stepIndex++,
          charIndex: i,
          char,
          currentState: currentStates[0] || -1,
          nextState: -1,
          transition: 'FAIL',
          isBacktrack: true,
          isMatch: false
        })
        break
      }
      currentStates = nextStates
      if (currentStates.some(s => states[s].isAccept)) { matched = true; matchEnd = i + 1 }
    }

    if (matched || (startPos === input.length && currentStates.some(s => states[s].isAccept))) {
      const matchText = input.substring(startPos, matchEnd)
      const duration = performance.now() - startTime
      return {
        matched: true,
        matchText,
        groups: [matchText],
        steps,
        backtracks,
        totalSteps: stepIndex,
        duration: Math.round(duration * 100) / 100
      }
    }
  }

  const duration = performance.now() - startTime
  return { matched: false, matchText: '', groups: [], steps, backtracks, totalSteps: stepIndex, duration: Math.round(duration * 100) / 100 }
}

export function computeNFA(nfaResult: ReturnType<typeof buildNFA>): NFA {
  const nodes = nfaResult.states.map((s, i) => ({
    id: s.id,
    isStart: i === nfaResult.startState,
    isAccept: nfaResult.acceptStates.includes(s.id),
    x: 0, y: 0
  }))

  // Layout: circular
  const cx = 400, cy = 300, radius = 200
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2
    n.x = cx + Math.cos(angle) * radius
    n.y = cy + Math.sin(angle) * radius
  })

  const transitions: any[] = []
  nfaResult.states.forEach(s => {
    s.transitions.forEach((targets, symbol) => {
      targets.forEach(t => {
        transitions.push({ from: s.id, to: t, symbol: symbol.startsWith('__') ? symbol.replace('__', '') : symbol, label: symbol.startsWith('__') ? symbol.replace('__', '') : symbol })
      })
    })
    s.epsilonTransitions.forEach(t => {
      transitions.push({ from: s.id, to: t, symbol: null, label: 'ε' })
    })
  })

  return { states: nodes, transitions, startState: nfaResult.startState, acceptStates: nfaResult.acceptStates }
}

export function parseAST(pattern: string): ASTNode {
  let pos = 0
  let groupIdx = 0

  function parseAtom(): ASTNode {
    const ch = pattern[pos]
    if (ch === '(') {
      pos++
      if (pattern[pos] === '?') { pos++; if (pattern[pos] === ':') pos++ }
      else groupIdx++
      const node = parseOr()
      if (pattern[pos] === ')') pos++
      return { type: 'group', children: [node], groupIndex: groupIdx }
    }
    if (ch === '[') {
      pos++
      let cls = ''
      while (pos < pattern.length && pattern[pos] !== ']') { cls += pattern[pos]; pos++ }
      pos++
      return { type: 'charclass', value: cls }
    }
    if (ch === '.') { pos++; return { type: 'dot' } }
    if (ch === '\\') {
      pos++
      const e = pattern[pos]; pos++
      if (e === 'd') return { type: 'digit' }
      if (e === 'w') return { type: 'word' }
      if (e === 's') return { type: 'space' }
      return { type: 'char', value: e }
    }
    if (ch === '^' || ch === '$') { pos++; return { type: 'anchor', value: ch } }
    pos++
    return { type: 'char', value: ch }
  }

  function parseQuantifier(): ASTNode {
    let node = parseAtom()
    while (pos < pattern.length && ['*', '+', '?', '{'].includes(pattern[pos])) {
      const q = pattern[pos]
      if (q === '{') {
        while (pos < pattern.length && pattern[pos] !== '}') pos++
        pos++
      } else {
        pos++
      }
      const type = q === '*' ? 'star' : q === '+' ? 'plus' : 'question'
      node = { type, children: [node] }
      if (pos < pattern.length && pattern[pos] === '?') pos++
    }
    return node
  }

  function parseConcat(): ASTNode {
    const nodes: ASTNode[] = []
    while (pos < pattern.length && !['|', ')'].includes(pattern[pos])) {
      nodes.push(parseQuantifier())
    }
    if (nodes.length === 1) return nodes[0]
    return { type: 'concat', children: nodes }
  }

  function parseOr(): ASTNode {
    let left = parseConcat()
    while (pos < pattern.length && pattern[pos] === '|') {
      pos++
      const right = parseConcat()
      left = { type: 'or', children: [left, right] }
    }
    return left
  }

  return parseOr()
}

export const useRegexStore = defineStore('regex', () => {
  const pattern = ref('^([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+)\\.([a-zA-Z]{2,})$')
  const testString = ref('user@example.com admin@mail.org invalid-email')
  const currentStep = ref(0)
  const isPlaying = ref(false)
  const nfa = ref<NFA | null>(null)
  const matchResult = ref<MatchResult | null>(null)
  const ast = ref<ASTNode | null>(null)
  const error = ref('')
  const selectedTemplate = ref<string>('')

  // —— 历史用例与会话恢复 ——
  const cases = ref<SavedCase[]>([])
  /** 当前打开/正在查看的用例 id；编辑后不再属于任何用例时清空 */
  const activeCaseId = ref<string | null>(null)
  /** 操作反馈（保存失败、重复保存、空历史等），由 UI 统一展示 */
  const message = ref<CaseMessage | null>(null)
  /** 启动恢复标志：true 表示已尝试过会话恢复 */
  const hydrated = ref(false)

  const groupColors = GROUP_COLORS

  /** 最近用例：按保存时间倒序 */
  const recentCases = computed(() =>
    [...cases.value].sort((a, b) => b.savedAt - a.savedAt)
  )

  let messageTimer: ReturnType<typeof setTimeout> | undefined
  function flash(type: CaseMessage['type'], text: string) {
    message.value = { type, text }
    if (messageTimer) clearTimeout(messageTimer)
    messageTimer = setTimeout(() => { message.value = null }, 4000)
  }

  function isValidResult(result: unknown): result is MatchResult {
    if (!result || typeof result !== 'object') return false
    const r = result as Record<string, unknown>
    return typeof r.matched === 'boolean' &&
      typeof r.matchText === 'string' &&
      Array.isArray(r.steps) &&
      typeof r.backtracks === 'number' &&
      typeof r.totalSteps === 'number' &&
      typeof r.duration === 'number'
  }

  function isValidCase(c: unknown): c is SavedCase {
    if (!c || typeof c !== 'object') return false
    const s = c as Record<string, unknown>
    return typeof s.id === 'string' &&
      typeof s.pattern === 'string' &&
      typeof s.testString === 'string' &&
      typeof s.currentStep === 'number' &&
      typeof s.savedAt === 'number' &&
      isValidResult(s.result)
  }

  /** 读取并过滤掉损坏的历史记录，返回有效用例 */
  function loadCases(): SavedCase[] {
    const raw = readJSON<unknown>(CASES_STORAGE_KEY)
    if (!Array.isArray(raw)) return []
    return raw.filter(isValidCase)
  }

  function persistCases(next: SavedCase[]): void {
    writeJSON(CASES_STORAGE_KEY, next)
  }

  function persistSession(snap: SessionSnapshot): void {
    writeJSON(SESSION_STORAGE_KEY, snap)
  }

  function clearSession(): void {
    removeKey(SESSION_STORAGE_KEY)
  }

  /** 深拷贝匹配结果，避免快照与运行态共享引用 */
  function cloneResult(result: MatchResult): MatchResult {
    return JSON.parse(JSON.stringify(result)) as MatchResult
  }

  function genId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID()
    }
    return `case-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }

  /**
   * 应用一份快照到工作区：恢复正则、测试文本、关注步骤、
   * 高亮（matchResult 快照）、统计，并重建 NFA/AST 使可视化一致。
   */
  function applySnapshot(snap: CaseSnapshot) {
    stop()
    pattern.value = snap.pattern
    testString.value = snap.testString
    matchResult.value = cloneResult(snap.result)
    error.value = ''
    selectedTemplate.value = ''

    // 重建状态机与语法树；即使快照结果可用，解析失败也不影响高亮恢复
    try {
      const built = buildNFA(snap.pattern)
      nfa.value = computeNFA(built)
      ast.value = parseAST(snap.pattern)
    } catch {
      nfa.value = null
      ast.value = null
    }

    const maxStep = Math.max(0, snap.result.steps.length - 1)
    currentStep.value = Math.min(Math.max(0, snap.currentStep), maxStep)
  }

  /**
   * 保存当前正则、测试文本和关注步骤到最近用例。
   * - 未执行匹配/解析失败时拒绝保存，编辑内容原样保留
   * - 同一用例（相同正则 + 测试文本）重复保存时更新关注步骤并置顶，不产生重复条目
   * - 存储写入失败时明确提示，编辑内容原样保留
   */
  function saveCase(): void {
    if (error.value) {
      flash('error', '当前正则存在解析错误，无法保存')
      return
    }
    if (!matchResult.value) {
      flash('error', '请先执行匹配再保存用例')
      return
    }

    const result = cloneResult(matchResult.value)
    const maxStep = Math.max(0, result.steps.length - 1)
    const step = Math.min(Math.max(0, currentStep.value), maxStep)
    const now = Date.now()

    // 同一用例：正则与测试文本均相同视为重复保存
    const existing = cases.value.find(
      c => c.pattern === pattern.value && c.testString === testString.value
    )

    let savedId: string
    let nextCases: SavedCase[]
    let isDuplicate = false

    if (existing) {
      isDuplicate = true
      savedId = existing.id
      nextCases = cases.value.map(c =>
        c.id === existing.id
          ? { ...c, currentStep: step, result, savedAt: now }
          : c
      )
    } else {
      const record: SavedCase = {
        id: genId(),
        pattern: pattern.value,
        testString: testString.value,
        currentStep: step,
        result,
        savedAt: now
      }
      savedId = record.id
      nextCases = [...cases.value, record]
    }

    // 会话先于列表写入：任一步失败都不改变内存中的编辑内容
    try {
      persistSession({ caseId: savedId, savedAt: now })
      persistCases(nextCases)
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : '保存失败，请检查浏览器存储设置'
      flash('error', text)
      return
    }

    cases.value = nextCases
    activeCaseId.value = savedId
    flash(
      'success',
      isDuplicate ? '该用例已存在，已更新关注步骤并置顶' : '用例已保存到最近用例'
    )
  }

  /**
   * 删除一条历史用例。
   * - 不影响当前编辑区内容（正在查看时也仅解除关联高亮标记）
   * - 若删除的是最后一次会话指向的用例，同步清除会话指针，
   *   避免旧快照在下次进入时唤起已删除历史
   */
  function deleteCase(id: string): void {
    const target = cases.value.find(c => c.id === id)
    if (!target) {
      flash('error', '该用例已不存在，列表已刷新')
      pruneMissingStorage()
      return
    }

    const nextCases = cases.value.filter(c => c.id !== id)
    try {
      persistCases(nextCases)
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : '删除失败，请稍后重试'
      flash('error', text)
      return
    }

    cases.value = nextCases
    if (activeCaseId.value === id) activeCaseId.value = null

    const session = readJSON<SessionSnapshot | null>(SESSION_STORAGE_KEY)
    if (session && session.caseId === id) {
      clearSession()
    }
    flash('success', '用例已删除，当前编辑内容已保留')
  }

  /**
   * 从最近用例按时间重新打开一条用例。
   * 恢复正则、测试文本、关注步骤、高亮与统计；
   * 目标已被删除时明确提示并保留当前编辑内容。
   */
  function openCase(id: string): void {
    const target = cases.value.find(c => c.id === id)
    if (!target) {
      flash('error', '该用例已被删除，无法打开')
      pruneMissingStorage()
      return
    }

    applySnapshot(target)
    activeCaseId.value = target.id
    try {
      persistSession({ caseId: target.id, savedAt: target.savedAt })
    } catch {
      // 用例已成功恢复到工作区，仅会话指针写入失败不阻断使用
      flash('info', '用例已打开，但浏览器存储不可用，下次进入可能无法恢复')
      return
    }
    flash('success', '已恢复用例')
  }

  /** 清理存储与会话不一致的状态（损坏数据等） */
  function pruneMissingStorage() {
    const valid = loadCases()
    cases.value = valid
    const session = readJSON<SessionSnapshot | null>(SESSION_STORAGE_KEY)
    if (session && !valid.some(c => c.id === session.caseId)) {
      clearSession()
    }
    if (activeCaseId.value && !valid.some(c => c.id === activeCaseId.value)) {
      activeCaseId.value = null
    }
  }

  /**
   * 启动 / 重新进入工作台时恢复最后一次会话。
   * 仅当会话指针仍指向历史中存在的用例时才恢复——
   * 已删除的历史不能被旧快照唤起。
   */
  function restoreSession(): boolean {
    // store 初始化时已执行过恢复：再次调用直接返回当前是否处于已恢复用例上
    if (hydrated.value) {
      return activeCaseId.value !== null
    }
    hydrated.value = true
    const validCases = loadCases()
    cases.value = validCases

    const session = readJSON<SessionSnapshot | null>(SESSION_STORAGE_KEY)
    if (!session || typeof session.caseId !== 'string') {
      return false
    }

    const target = validCases.find(c => c.id === session.caseId)
    if (!target) {
      // 旧快照指向的历史已删除：清除悬空指针，不恢复任何内容
      clearSession()
      activeCaseId.value = null
      return false
    }

    applySnapshot(target)
    activeCaseId.value = target.id
    return true
  }

  const matchHighlight = computed(() => {
    if (!matchResult.value || !matchResult.value.matched) return null
    const matchText = matchResult.value.matchText
    const idx = testString.value.indexOf(matchText)
    if (idx === -1) return null
    return {
      before: testString.value.substring(0, idx),
      match: matchText,
      after: testString.value.substring(idx + matchText.length)
    }
  })

  function execute() {
    error.value = ''
    try {
      const built = buildNFA(pattern.value)
      nfa.value = computeNFA(built)
      matchResult.value = runMatch(built.states, built.startState, testString.value)
      ast.value = parseAST(pattern.value)
      currentStep.value = 0
    } catch (e: any) {
      error.value = e.message || '正则表达式解析错误'
      nfa.value = null
      matchResult.value = null
      ast.value = null
    }
  }

  /** 内容一旦改动即与已保存用例脱钩（用例本身仍保留在历史中） */
  function detachActiveCase() {
    activeCaseId.value = null
  }

  function setPattern(p: string) {
    pattern.value = p
    detachActiveCase()
    execute()
  }

  function setTestString(s: string) {
    testString.value = s
    detachActiveCase()
    execute()
  }

  function applyTemplate(t: RegexTemplate) {
    pattern.value = t.pattern
    testString.value = t.testString
    selectedTemplate.value = t.name
    detachActiveCase()
    execute()
  }

  function stepForward() {
    if (matchResult.value && currentStep.value < matchResult.value.steps.length - 1) {
      currentStep.value++
    }
  }

  function stepBackward() {
    if (currentStep.value > 0) currentStep.value--
  }

  function resetStep() {
    currentStep.value = 0
  }

  let playTimer: ReturnType<typeof setInterval> | undefined

  function play() {
    if (isPlaying.value) return
    isPlaying.value = true
    playTimer = setInterval(() => {
      if (matchResult.value && currentStep.value < matchResult.value.steps.length - 1) {
        currentStep.value++
      } else {
        stop()
      }
    }, 200)
  }

  function stop() {
    isPlaying.value = false
    if (playTimer) {
      clearInterval(playTimer)
      playTimer = undefined
    }
  }

  // store 创建即尝试恢复最后一次会话（Pinia 在 app.mount 前安装，
  // 因此组件首次渲染拿到的就是恢复后的高亮、播放位置与统计）
  restoreSession()

  return {
    pattern, testString, currentStep, isPlaying, nfa, matchResult, ast, error,
    selectedTemplate, groupColors, matchHighlight,
    cases, recentCases, activeCaseId, message, hydrated,
    execute, setPattern, setTestString, applyTemplate,
    stepForward, stepBackward, resetStep, play, stop,
    saveCase, deleteCase, openCase, restoreSession
  }
})
