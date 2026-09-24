<template>
  <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-bold text-slate-400">最近用例</h3>
      <span class="text-xs text-slate-500">{{ store.recentCases.length }} 条 · 按时间倒序</span>
    </div>

    <div v-if="store.recentCases.length === 0" class="text-sm text-slate-500 bg-slate-900 rounded-lg p-4 text-center">
      <div class="mb-1 text-2xl">🗂️</div>
      暂无保存的用例
      <div class="text-xs mt-1 text-slate-600">执行匹配后点击"保存用例"，可在此重新打开</div>
    </div>

    <div v-else class="space-y-2 max-h-80 overflow-y-auto">
      <div
        v-for="c in store.recentCases"
        :key="c.id"
        class="rounded-lg border p-2.5 transition-all cursor-pointer group"
        :class="c.id === store.activeCaseId
          ? 'border-emerald-500 bg-emerald-900/20'
          : 'border-slate-700 bg-slate-900 hover:border-slate-500'"
        @click="store.openCase(c.id)"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs text-slate-500 shrink-0">{{ formatTime(c.savedAt) }}</span>
          <div class="flex items-center gap-2 shrink-0">
            <span
              class="text-xs px-1.5 py-0.5 rounded"
              :class="c.result.matched ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'"
            >{{ c.result.matched ? '✓ 匹配' : '✗ 未匹配' }}</span>
            <button
              @click.stop="onDelete(c.id)"
              title="删除该用例（不影响当前编辑）"
              class="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-sm leading-none px-1"
            >✕</button>
          </div>
        </div>
        <div class="text-xs font-mono text-cyan-500 mt-1 truncate">{{ c.pattern || '(空正则)' }}</div>
        <div class="text-xs font-mono text-slate-400 mt-0.5 truncate">{{ c.testString || '(空文本)' }}</div>
        <div class="text-[11px] text-slate-600 mt-1">
          关注步骤 {{ c.currentStep }}/{{ Math.max(0, c.result.steps.length - 1) }}
          · {{ c.result.totalSteps }} 步 · {{ c.result.backtracks }} 回溯
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRegexStore } from '../store/regex'

const store = useRegexStore()

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

  const today = new Date()
  const isToday = d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  return isToday ? `今天 ${time}` : `${date} ${time}`
}

function onDelete(id: string) {
  store.deleteCase(id)
}
</script>
