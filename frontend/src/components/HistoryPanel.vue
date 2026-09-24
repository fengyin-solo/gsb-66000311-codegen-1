<template>
  <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-bold text-slate-400">最近用例 ({{ store.history.length }})</h3>
      <span v-if="store.history.length > 0" class="text-xs text-slate-600">按时间倒序</span>
    </div>

    <div v-if="store.history.length === 0" class="text-slate-500 text-xs border border-dashed border-slate-700 rounded-lg p-3 text-center leading-5">
      暂无保存的用例<br />执行匹配后点击「💾 保存用例」即可收藏当前调试现场
    </div>

    <div v-else class="space-y-2 max-h-72 overflow-y-auto">
      <div
        v-for="c in sortedHistory"
        :key="c.id"
        @click="store.openCase(c.id)"
        :class="['cursor-pointer p-2 rounded-lg border transition-all', store.activeCaseId === c.id ? 'border-cyan-500 bg-cyan-900/30' : 'border-slate-700 bg-slate-900 hover:border-slate-500']"
        title="点击重新打开该用例"
      >
        <div class="flex items-start justify-between gap-2">
          <span class="font-mono text-xs text-cyan-400 truncate">/{{ c.pattern }}/</span>
          <button
            @click.stop="store.deleteCase(c.id)"
            class="text-slate-500 hover:text-red-400 text-xs px-1 shrink-0"
            title="删除该用例"
          >✕</button>
        </div>
        <div class="text-xs text-slate-500 truncate mt-1">测试文本: {{ c.testString || '(空)' }}</div>
        <div class="flex items-center justify-between text-xs mt-1">
          <span class="text-slate-600">{{ formatTime(c.savedAt) }}</span>
          <span class="flex items-center gap-2">
            <span v-if="c.matchResult" :class="c.matchResult.matched ? 'text-green-500' : 'text-red-400'">
              {{ c.matchResult.matched ? '✓ 匹配' : '✗ 未匹配' }}
            </span>
            <span class="text-slate-600">关注步骤 {{ c.currentStep }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRegexStore } from '../store/regex'
import { formatTime } from '../utils/persistence'

const store = useRegexStore()
const sortedHistory = computed(() => [...store.history].sort((a, b) => b.savedAt - a.savedAt))
</script>
