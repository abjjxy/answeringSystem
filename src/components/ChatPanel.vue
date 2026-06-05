<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import type { ChatMessage, AgentStep } from '../types';
import { Send, Sparkles, HelpCircle, Loader2, PlayCircle, FileSpreadsheet, Network } from 'lucide-vue-next';
import { marked } from 'marked';

interface Props {
  messages: ChatMessage[];
  loading: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'sendMessage', text: string): void;
}>();

const inputText = ref('');
const messagesEndRef = ref<HTMLDivElement | null>(null);

const predefinedQueries = [
  '文彭属于什么印派？他的字号、生卒年及父亲是谁？',
  '查一下何震和印人传里人物的交游好友圈',
  '谁开创了西泠印学（浙派）？有哪些传人和印风？',
  '找出所有在清代、擅长浙派或皖派印风的主要人物名单及生年',
  '分析丁敬到吴昌硕在金石师承网络中的衔接路径'
];

const handleSend = () => {
  const text = inputText.value.trim();
  if (!text) return;
  emit('sendMessage', text);
  inputText.value = '';
};

const handleKeyPress = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
};

const scrollToBottom = () => {
  nextTick(() => {
    messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' });
  });
};

const renderMarkdown = (text: string) => {
  return marked.parse(text || '');
};

watch(() => props.messages, scrollToBottom, { deep: true });
watch(() => props.loading, scrollToBottom);
</script>

<template>
  <div class="flex flex-col h-full bg-[#FCFAF7] border border-[#E9E4DC] rounded-xl shadow-sm overflow-hidden" id="chat_panel">
    <!-- Upper header -->
    <div class="px-4 py-3 bg-[#F4EFE6] border-b border-[#E9E4DC] flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Sparkles class="w-4 h-4 text-[#8C2D19]" />
        <span class="font-medium text-[#2D241E]">墨香金石 · AI 探索答策</span>
      </div>
      <span class="text-[10px] px-2 py-0.5 bg-white text-[#8C2D19] border border-[#E9E4DC] rounded-full font-serif font-bold">
        金石图谱RAG
      </span>
    </div>

    <!-- Messages area -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]" id="message_scroller">
      <div v-if="props.messages.length === 0" class="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div class="w-12 h-12 rounded-full bg-[#F4EFE6] flex items-center justify-center text-[#8C2D19]">
          <HelpCircle class="w-6 h-6" />
        </div>
        <div>
          <h3 class="font-serif font-bold text-base text-[#2D241E] mb-1">金石印学智囊已就绪</h3>
          <p class="text-xs text-[#998D80] max-w-sm">
            支持《印人传》生平检索、门派隶属、地名、字号及多跳师从关系交游图谱多模态对答。
          </p>
        </div>

        <!-- Quick pre-baked queries -->
        <div class="w-full max-w-md pt-2 space-y-1.5 text-left">
          <span class="text-[10px] font-bold text-[#8C2D19] tracking-wider uppercase pl-2">特色问句示例</span>
          <div class="grid grid-cols-1 gap-1.5">
            <button
              v-for="(q, idx) in predefinedQueries"
              :key="idx"
              @click="inputText = q"
              class="p-2 bg-white hover:bg-[#FAF8F5] border border-[#E9E4DC] hover:border-[#8C2D19]/40 text-[#5C5246] hover:text-[#2D241E] rounded-lg text-left text-xs transition-all duration-150 flex items-start gap-1.5 cursor-pointer"
            >
              <PlayCircle class="w-3.5 h-3.5 text-[#8C2D19] mt-0.5 shrink-0" />
              <span>{{ q }}</span>
            </button>
          </div>
        </div>
      </div>

      <template v-else>
        <div
          v-for="(msg, idx) in props.messages"
          :key="msg.id || idx"
          class="flex flex-col"
          :class="msg.role === 'user' ? 'items-end' : 'items-start'"
        >
          <div class="text-[10px] text-[#A1978E] mb-0.5 px-1">{{ msg.role === 'user' ? '问策士' : '金石智囊' }}</div>
          <div
            :class="[
              'max-w-[85%] rounded-xl px-4 py-3 shadow-xs leading-relaxed text-sm',
              msg.role === 'user'
                ? 'bg-[#8C2D19] text-white rounded-tr-none font-medium'
                : 'bg-white border border-[#E9E4DC] text-[#2D241E] rounded-tl-none font-serif'
            ]"
          >
            <!-- Regular content -->
            <div v-if="msg.role === 'assistant'" class="markdown-body" v-html="renderMarkdown(msg.content)"></div>
            <span v-else class="whitespace-pre-wrap">{{ msg.content }}</span>

            <!-- DB Alignment visual reference -->
            <div v-if="msg.role === 'assistant' && msg.visualData" class="mt-3">
              <div v-if="msg.visualData.type === 'sparql_table' && msg.visualData.payload" class="overflow-x-auto border border-[#E9E4DC] rounded-lg">
                <table class="min-w-full divide-y divide-[#E9E4DC] text-left text-xs bg-white">
                  <thead class="bg-[#FAF8F5]">
                    <tr>
                      <th v-for="(h, i) in msg.visualData.payload.headers" :key="i" class="px-3 py-2 font-semibold text-[#5C5246]">{{ h }}</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100 text-gray-600">
                    <tr v-for="(row, rIdx) in msg.visualData.payload.rows" :key="rIdx" class="hover:bg-gray-50 transition-colors">
                      <td v-for="(h, cIdx) in msg.visualData.payload.headers" :key="cIdx" class="px-3 py-1.5 font-mono text-[10px]">
                        {{ typeof row === 'object' ? (row[h] || '-') : (row[cIdx] || '-') }}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div class="bg-[#FAF8F5] px-3 py-1 border-t border-[#E9E4DC] text-[9px] text-[#998D80] flex items-center gap-1 font-sans">
                  <FileSpreadsheet class="w-3.5 h-3.5 text-gray-400" />
                  <span>知识图谱 SPARQL 结果视图 ({{ msg.visualData.payload.rows.length }} 条)</span>
                </div>
              </div>

              <div v-else-if="msg.visualData.type === 'paths' && msg.visualData.payload && msg.visualData.payload.found" class="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs font-sans">
                <div class="font-bold text-[#8C2D19] mb-1.5 flex items-center gap-1">
                  <Network class="w-3.5 h-3.5" />
                  <span>师承与交游路径追踪结果</span>
                </div>
                <div class="flex flex-wrap items-center gap-1.5 py-1">
                  <template v-for="(node, nIdx) in msg.visualData.payload.path" :key="nIdx">
                    <span class="px-2 py-1 bg-white border border-[#E9E4DC] rounded font-medium text-[#2D241E] font-serif">
                      {{ node }}
                    </span>
                    <span v-if="nIdx < msg.visualData.payload.path.length - 1" class="text-gray-400 text-[10px]">
                      — ({{ msg.visualData.payload.edges[nIdx]?.relation || '联系' }}) →
                    </span>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <!-- Show Agent detailed workflow under assistant bubble -->
          <div v-if="msg.role === 'assistant' && msg.steps && msg.steps.length > 0" class="mt-3 p-3 bg-[#FAF8F5] border border-[#E9E4DC] rounded-lg text-xs text-[#5C5246] space-y-2 w-full max-w-[85%] font-sans">
            <div class="font-bold flex items-center gap-1.5 text-[#8C2D19] border-b border-[#E9E4DC] pb-1 mb-1.5">
              <Sparkles class="w-3.5 h-3.5 animate-pulse" />
              <span>金石代理协同工作流 (Agent Task Lifecycle)</span>
            </div>
            <div class="relative pl-3 border-l-2 border-[#DCD6CD] space-y-2.5">
              <div v-for="(step, sIdx) in msg.steps" :key="sIdx" class="relative">
                <span
                  :class="[
                    'absolute -left-[18px] top-1 w-2.5 h-2.5 rounded-full border-2',
                    step.status === 'success'
                      ? 'bg-emerald-600 border-white ring-2 ring-emerald-100'
                      : step.status === 'failure'
                        ? 'bg-rose-600 border-white ring-2 ring-rose-100'
                        : 'bg-amber-500 border-white ring-2 ring-amber-100 animate-pulse'
                  ]"
                />
                <div class="font-medium text-[#2D241E] flex items-center gap-2">
                  <span>{{ step.name }}</span>
                  <span
                    :class="[
                      'text-[9px] px-1 rounded',
                      step.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    ]"
                  >
                    {{ step.status === 'success' ? '节点成功' : '执行中' }}
                  </span>
                </div>
                <div class="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{{ step.detail }}</div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-if="props.loading" class="flex flex-col items-start font-sans">
        <div class="text-[10px] text-gray-400 mb-0.5">金石智囊计算中</div>
        <div class="bg-white border border-dashed border-gray-300 rounded-xl rounded-tl-none p-3 shadow-xs text-xs text-gray-500 flex items-center gap-2">
          <Loader2 class="w-4 h-4 animate-spin text-[#8C2D19]" />
          <span>协同代理工作流正在多步推导并联结图谱数据...</span>
        </div>
      </div>
      <div ref="messagesEndRef" />
    </div>

    <!-- Input panel bar -->
    <div class="p-3 bg-[#FAF8F5] border-t border-[#E9E4DC]">
      <div class="relative flex gap-2">
        <textarea
          v-model="inputText"
          @keydown="handleKeyPress"
          placeholder="雅问，如：'谁是何震的老师，他们精通什么印风？' (Enter直接发送)"
          class="flex-1 min-h-[44px] max-h-[120px] rounded-lg border border-[#C1B5A3] bg-white px-3 py-2.5 text-xs text-[#2D241E] focus:border-[#8C2D19] focus:outline-none focus:ring-1 focus:ring-[#8C2D19] resize-none"
          rows="2"
        />
        <button
          @click="handleSend"
          :disabled="props.loading || !inputText.trim()"
          class="p-3 bg-[#8C2D19] hover:bg-[#6E2213] disabled:bg-[#BAC6BA] disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center shrink-0 self-end cursor-pointer"
          id="btn_send"
        >
          <Send class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>
