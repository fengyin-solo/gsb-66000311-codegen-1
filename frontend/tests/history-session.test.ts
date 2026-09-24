/**
 * 历史用例与会话恢复 测试
 * 运行: npm run test（tsc 编译后由 node 执行）
 */
import { createPinia, setActivePinia } from 'pinia'
import {
  STORAGE_KEYS, MAX_HISTORY, mergeHistory, findDuplicate, clampStep, sanitizeHistory,
  loadJSON, saveJSON, loadTombstones, loadSession,
  type StorageLike
} from '../src/utils/persistence'
import type { HistoryCase } from '../src/types'
import { useRegexStore } from '../src/store/regex'

// 极简断言（避免依赖 @types/node）
const assert = {
  equal(actual: unknown, expected: unknown) {
    if (actual !== expected) throw new Error(`断言失败: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`)
  },
  deepEqual(actual: unknown, expected: unknown) {
    const a = JSON.stringify(actual)
    const b = JSON.stringify(expected)
    if (a !== b) throw new Error(`断言失败: ${a} !== ${b}`)
  },
  ok(value: unknown, msg = '断言失败: 期望为真') {
    if (!value) throw new Error(msg)
  }
}

function createMockStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => { data.set(k, String(v)) },
    removeItem: (k: string) => { data.delete(k) }
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function makeCase(over: Partial<HistoryCase> = {}): HistoryCase {
  return { id: 'case-a', pattern: '\\d+', testString: 'abc123', currentStep: 0, savedAt: 1000, matchResult: null, ...over }
}

const tests: { name: string; fn: () => void | Promise<void> }[] = []
const test = (name: string, fn: () => void | Promise<void>) => tests.push({ name, fn })

// ---------- 纯逻辑 ----------

test('mergeHistory: 合并存储与快照并保留原有用例，按时间倒序', () => {
  const stored = [makeCase({ id: 'a', savedAt: 100 }), makeCase({ id: 'b', savedAt: 300 })]
  const snapshot = [makeCase({ id: 'c', savedAt: 200 })]
  const merged = mergeHistory(stored, snapshot, [])
  assert.deepEqual(merged.map(c => c.id), ['b', 'c', 'a'])
})

test('mergeHistory: 同 id 取 savedAt 更新的一条', () => {
  const stored = [makeCase({ id: 'a', savedAt: 100, testString: 'old' })]
  const snapshot = [makeCase({ id: 'a', savedAt: 200, testString: 'new' })]
  const merged = mergeHistory(stored, snapshot, [])
  assert.equal(merged.length, 1)
  assert.equal(merged[0].testString, 'new')
})

test('mergeHistory: 已删除（墓碑）用例不会被旧快照唤起', () => {
  const stored = [makeCase({ id: 'keep', savedAt: 100 })]
  const snapshot = [makeCase({ id: 'deleted', savedAt: 500 }), makeCase({ id: 'keep', savedAt: 100 })]
  const merged = mergeHistory(stored, snapshot, ['deleted'])
  assert.deepEqual(merged.map(c => c.id), ['keep'])
})

test('mergeHistory: 历史上限截断', () => {
  const many = Array.from({ length: MAX_HISTORY + 10 }, (_, i) => makeCase({ id: 'c' + i, savedAt: i }))
  assert.equal(mergeHistory(many, [], []).length, MAX_HISTORY)
})

test('findDuplicate: 正则+测试文本一致才算同一用例', () => {
  const h = [makeCase({ id: 'a', pattern: '\\d+', testString: 'x1' })]
  assert.ok(findDuplicate(h, '\\d+', 'x1'))
  assert.equal(findDuplicate(h, '\\d+', 'x2'), undefined)
  assert.equal(findDuplicate(h, '\\w+', 'x1'), undefined)
})

test('clampStep: 步骤钳制在合法范围', () => {
  assert.equal(clampStep(3, 10), 3)
  assert.equal(clampStep(99, 10), 9)
  assert.equal(clampStep(-1, 10), 0)
  assert.equal(clampStep(5, 0), 0)
  assert.equal(clampStep(NaN, 5), 0)
})

test('sanitizeHistory: 过滤损坏条目', () => {
  const out = sanitizeHistory([makeCase(), null, { id: 1 }, 'x', undefined,
    { id: 'b', pattern: 'p', testString: 't', savedAt: 1 }])
  assert.equal(out.length, 2)
  assert.equal(sanitizeHistory('not-array').length, 0)
  assert.equal(sanitizeHistory(null).length, 0)
})

test('saveJSON/loadJSON: 失败返回 false，损坏 JSON 返回 null', () => {
  const ok = createMockStorage()
  assert.equal(saveJSON('k', { a: 1 }, ok), true)
  assert.deepEqual(loadJSON('k', ok), { a: 1 })
  const bad: StorageLike = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError') }, removeItem: () => {} }
  assert.equal(saveJSON('k', {}, bad), false)
  ok.data.set('corrupt', '{not json')
  assert.equal(loadJSON('corrupt', ok), null)
})

// ---------- store 集成 ----------

test('空历史 + 未执行匹配时保存：明确提示且不产生用例', () => {
  ;(globalThis as any).localStorage = createMockStorage()
  setActivePinia(createPinia())
  const s = useRegexStore()
  assert.equal(s.history.length, 0) // 空历史
  assert.equal(s.matchResult, null)
  assert.equal(s.saveCurrentCase(), false)
  assert.equal(s.saveFeedback?.type, 'warn')
  assert.equal(s.history.length, 0)
})

test('完整流程：保存/重复/刷新恢复/重开一致/删除不复活/保存失败保留编辑', async () => {
  const mock = createMockStorage()
  ;(globalThis as any).localStorage = mock

  // 首次进入：空历史，执行匹配后保存（关注步骤 2）
  setActivePinia(createPinia())
  const s1 = useRegexStore()
  assert.equal(s1.history.length, 0)
  s1.setPattern('^(\\d+)-(\\w+)$')
  s1.setTestString('123-abc 456-def')
  assert.ok(s1.matchResult)
  assert.equal(s1.matchResult!.matched, true)
  s1.currentStep = 2
  assert.equal(s1.saveCurrentCase(), true)
  assert.equal(s1.history.length, 1)
  assert.equal(s1.saveFeedback?.type, 'success')
  const firstCase = s1.history[0]
  const savedSnapshot = JSON.parse(JSON.stringify(s1.matchResult))

  // 同一用例重复保存：明确提示，不重复添加，编辑内容不变
  assert.equal(s1.saveCurrentCase(), false)
  assert.equal(s1.saveFeedback?.type, 'warn')
  assert.equal(s1.history.length, 1)
  assert.equal(s1.pattern, firstCase.pattern)

  // 修改内容后保存第二例
  s1.setPattern('^\\d+$')
  s1.setTestString('12345')
  assert.equal(s1.saveCurrentCase(), true)
  assert.equal(s1.history.length, 2)

  await sleep(400) // 等待会话防抖持久化

  // 刷新（全新 pinia）：同步恢复最后一次会话，保留原有用例
  setActivePinia(createPinia())
  const s2 = useRegexStore()
  assert.equal(s2.history.length, 2)
  assert.equal(s2.pattern, '^\\d+$')
  assert.equal(s2.testString, '12345')
  assert.ok(s2.matchResult)
  assert.equal(s2.matchResult!.matched, true)

  // 重新打开第一个用例：高亮/播放位置/统计与保存时一致
  assert.equal(s2.openCase(firstCase.id), true)
  assert.equal(s2.pattern, firstCase.pattern)
  assert.equal(s2.testString, firstCase.testString)
  assert.equal(s2.currentStep, 2)
  assert.equal(s2.matchResult!.totalSteps, savedSnapshot.totalSteps)
  assert.equal(s2.matchResult!.duration, savedSnapshot.duration)
  assert.equal(s2.matchResult!.matchText, savedSnapshot.matchText)
  assert.equal(s2.matchResult!.backtracks, savedSnapshot.backtracks)
  assert.equal(s2.matchHighlight?.match, savedSnapshot.matchText)

  // 打开不存在的用例：明确提示
  assert.equal(s2.openCase('not-exist'), false)
  assert.equal(s2.saveFeedback?.type, 'error')

  // 删除第二例 → 写入墓碑
  const deletedId = s2.history.find(c => c.id !== firstCase.id)!.id
  s2.deleteCase(deletedId)
  assert.equal(s2.history.length, 1)
  assert.ok(loadTombstones(mock).includes(deletedId))

  await sleep(400)

  // 构造“旧快照”：把已删除用例塞回 session.historySnapshot
  const session = loadSession(mock)!
  const stale = makeCase({ id: deletedId, pattern: '^\\d+$', testString: '12345', savedAt: Date.now() })
  saveJSON(STORAGE_KEYS.session, { ...session, historySnapshot: [stale, ...session.historySnapshot] }, mock)

  // 再次进入：已删除历史不能被旧快照唤起，原有用例保留
  setActivePinia(createPinia())
  const s3 = useRegexStore()
  assert.equal(s3.history.some(c => c.id === deletedId), false)
  assert.equal(s3.history.length, 1)
  assert.equal(s3.history[0].id, firstCase.id)

  // 保存失败（存储抛错）：明确提示，历史不变，当前编辑内容保留
  s3.setPattern('xyz+')
  const originalSet = mock.setItem
  mock.setItem = () => { throw new Error('QuotaExceededError') }
  assert.equal(s3.saveCurrentCase(), false)
  assert.equal(s3.saveFeedback?.type, 'error')
  assert.equal(s3.history.length, 1)
  assert.equal(s3.pattern, 'xyz+')
  mock.setItem = originalSet

  // 会话恢复播放位置：移动步骤后等待持久化，再次进入应还原
  s3.currentStep = 1
  await sleep(400)
  setActivePinia(createPinia())
  const s4 = useRegexStore()
  assert.equal(s4.currentStep, 1)
  assert.equal(s4.pattern, 'xyz+')

  // 删除全部 → 空历史
  s4.deleteCase(firstCase.id)
  assert.equal(s4.history.length, 0)
})

// ---------- 运行器 ----------

async function main() {
  let passed = 0
  for (const t of tests) {
    await t.fn()
    passed++
    console.log(`✓ ${t.name}`)
  }
  console.log(`\n${passed}/${tests.length} 个测试通过`)
}

main().catch(e => {
  console.error(e)
  throw e
})
