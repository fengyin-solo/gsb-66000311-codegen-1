<template>
  <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
    <h3 class="text-sm font-bold text-slate-400 mb-3">正则表达式输入</h3>
    <div class="relative">
      <span class="absolute left-3 top-2 text-cyan-500 font-bold text-lg">/</span>
      <input
        v-model="localPattern"
        @input="onInput"
        @keyup.enter="execute"
        type="text"
        placeholder="输入正则表达式..."
        class="w-full bg-slate-900 border border-slate-600 rounded-lg pl-8 pr-12 py-2 text-cyan-400 font-mono text-sm focus:outline-none focus:border-cyan-500"
      />
      <span class="absolute right-3 top-2 text-cyan-500 font-bold text-lg">/g</span>
    </div>
    <div v-if="store.error" class="mt-2 text-red-400 text-sm">⚠ {{ store.error }}</div>
    <textarea
      v-model="localTestString"
      @input="onTestInput"
      placeholder="输入测试字符串..."
      rows="3"
      class="w-full mt-3 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 font-mono text-sm focus:outline-none focus:border-cyan-500 resize-none"
    ></textarea>
    <div class="flex gap-2 mt-3">
      <button @click="execute" class="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white font-bold text-sm">执行匹配</button>
      <button
        @click="store.saveCurrentCase()"
        class="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-200"
        title="保存当前正则、测试文本与关注步骤到最近用例"
      >💾 保存用例</button>
    </div>
    <div v-if="store.saveFeedback" class="mt-2 text-xs px-2 py-1.5 rounded" :class="feedbackClass">
      {{ store.saveFeedback.text }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRegexStore } from '../store/regex'

const store = useRegexStore()
const localPattern = ref(store.pattern)
const localTestString = ref(store.testString)

// 外部变更（打开历史用例 / 会话恢复 / 应用模板）时同步回输入框
watch(() => store.pattern, v => { if (v !== localPattern.value) localPattern.value = v })
watch(() => store.testString, v => { if (v !== localTestString.value) localTestString.value = v })

const feedbackClass = computed(() => {
  const t = store.saveFeedback?.type
  if (t === 'success') return 'bg-green-900/50 text-green-300 border border-green-800'
  if (t === 'warn') return 'bg-yellow-900/50 text-yellow-300 border border-yellow-800'
  return 'bg-red-900/50 text-red-300 border border-red-800'
})

let debounceTimer: ReturnType<typeof setTimeout>
function onInput() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { store.setPattern(localPattern.value) }, 300)
}
function onTestInput() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { store.setTestString(localTestString.value) }, 300)
}
function execute() {
  store.setPattern(localPattern.value)
  store.setTestString(localTestString.value)
  store.execute()
}
</script>
