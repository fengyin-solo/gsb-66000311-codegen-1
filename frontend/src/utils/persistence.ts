import type { HistoryCase, SessionSnapshot } from '../types'

export const STORAGE_KEYS = {
  history: 'regex-visual-debugger:history',
  session: 'regex-visual-debugger:session',
  tombstones: 'regex-visual-debugger:tombstones'
} as const

export const MAX_HISTORY = 50
const MAX_TOMBSTONES = 200

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage
  } catch {
    // 隐私模式等场景下访问 localStorage 可能直接抛错
  }
  return null
}

export function loadJSON<T>(key: string, storage: StorageLike | null = defaultStorage()): T | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(key)
    if (raw == null) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** 返回 false 表示持久化失败（存储不可用/配额超限），调用方需明确处理 */
export function saveJSON(key: string, value: unknown, storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false
  try {
    storage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/** 清洗历史数据，过滤损坏/不完整条目 */
export function sanitizeHistory(input: unknown): HistoryCase[] {
  if (!Array.isArray(input)) return []
  const out: HistoryCase[] = []
  for (const c of input) {
    if (!c || typeof c !== 'object') continue
    const r = c as Record<string, unknown>
    if (typeof r.id !== 'string' || typeof r.pattern !== 'string'
      || typeof r.testString !== 'string' || typeof r.savedAt !== 'number') continue
    out.push({
      id: r.id,
      pattern: r.pattern,
      testString: r.testString,
      savedAt: r.savedAt,
      currentStep: typeof r.currentStep === 'number' ? r.currentStep : 0,
      matchResult: r.matchResult && typeof r.matchResult === 'object'
        ? (r.matchResult as HistoryCase['matchResult'])
        : null
    })
  }
  return out
}

/**
 * 合并存储中的历史与会话快照中的历史：
 * - 同 id 取 savedAt 更新的一条
 * - 墓碑（已删除）id 一律过滤，旧快照无法唤起已删除用例
 * - 结果按时间倒序并截断到上限
 */
export function mergeHistory(stored: HistoryCase[], snapshot: HistoryCase[], tombstones: Iterable<string>): HistoryCase[] {
  const tomb = new Set(tombstones)
  const byId = new Map<string, HistoryCase>()
  for (const c of [...stored, ...snapshot]) {
    if (tomb.has(c.id)) continue
    const existing = byId.get(c.id)
    if (!existing || c.savedAt >= existing.savedAt) byId.set(c.id, c)
  }
  return Array.from(byId.values())
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, MAX_HISTORY)
}

/** 同一用例判定：正则与测试文本完全一致 */
export function findDuplicate(history: HistoryCase[], pattern: string, testString: string): HistoryCase | undefined {
  return history.find(c => c.pattern === pattern && c.testString === testString)
}

export function clampStep(step: number, stepsLength: number): number {
  if (!Number.isFinite(step)) return 0
  const max = Math.max(0, stepsLength - 1)
  return Math.min(Math.max(0, Math.floor(step)), max)
}

export function genId(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

export function loadHistory(storage?: StorageLike | null): HistoryCase[] {
  return sanitizeHistory(loadJSON(STORAGE_KEYS.history, storage))
}

export function saveHistory(list: HistoryCase[], storage?: StorageLike | null): boolean {
  return saveJSON(STORAGE_KEYS.history, list.slice(0, MAX_HISTORY), storage)
}

export function loadTombstones(storage?: StorageLike | null): string[] {
  const raw = loadJSON<unknown>(STORAGE_KEYS.tombstones, storage)
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
}

export function saveTombstones(ids: string[], storage?: StorageLike | null): boolean {
  return saveJSON(STORAGE_KEYS.tombstones, Array.from(new Set(ids)).slice(-MAX_TOMBSTONES), storage)
}

export function loadSession(storage?: StorageLike | null): SessionSnapshot | null {
  const raw = loadJSON<SessionSnapshot>(STORAGE_KEYS.session, storage)
  if (!raw || typeof raw !== 'object') return null
  if (typeof raw.pattern !== 'string' || typeof raw.testString !== 'string') return null
  return {
    pattern: raw.pattern,
    testString: raw.testString,
    currentStep: typeof raw.currentStep === 'number' ? raw.currentStep : 0,
    matchResult: raw.matchResult && typeof raw.matchResult === 'object' ? raw.matchResult : null,
    historySnapshot: sanitizeHistory(raw.historySnapshot),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0
  }
}

export function saveSession(snapshot: SessionSnapshot, storage?: StorageLike | null): boolean {
  return saveJSON(STORAGE_KEYS.session, snapshot, storage)
}

export function formatTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
