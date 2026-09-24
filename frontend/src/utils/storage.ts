/**
 * 本地持久化封装。
 * 所有访问都做了异常保护：隐私模式、配额超限、存储被禁用时
 * read 返回 null，write/remove 抛出异常由调用方明确处理。
 */

export const CASES_STORAGE_KEY = 'regex-debugger:cases'
export const SESSION_STORAGE_KEY = 'regex-debugger:last-session'

function storageAvailable(): boolean {
  try {
    const probe = '__regex_probe__'
    localStorage.setItem(probe, probe)
    localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

export function readJSON<T>(key: string): T | null {
  if (!storageAvailable()) return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** 写入失败（配额、禁用等）时抛出异常，调用方需捕获并提示。 */
export function writeJSON(key: string, value: unknown): void {
  if (!storageAvailable()) {
    throw new Error('本地存储不可用')
  }
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    throw new Error('保存失败：本地存储空间不足或被浏览器禁用')
  }
}

export function removeKey(key: string): void {
  if (!storageAvailable()) return
  try {
    localStorage.removeItem(key)
  } catch {
    /* 忽略删除失败 */
  }
}
