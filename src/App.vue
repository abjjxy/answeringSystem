<script setup lang="ts">
import { ref, onMounted } from 'vue';
import NetworkGraph from './components/NetworkGraph.vue';
import ChatPanel from './components/ChatPanel.vue';
import QueryPanel from './components/QueryPanel.vue';
import DataBrowser from './components/DataBrowser.vue';
import GraphStructures from './components/GraphStructures.vue';
import OntologySpec from './components/OntologySpec.vue';
import type { GraphData, GraphNode, ChatMessage } from './types';
import { 
  Sparkles, 
  GitCompare, 
  FileCode, 
  Cpu, 
  Database, 
  Feather, 
  Clock 
} from 'lucide-vue-next';

const graphData = ref<GraphData>({ nodes: [], links: [] });
const selectedNode = ref<GraphNode | null>(null);
const messages = ref<ChatMessage[]>([]);
const loading = ref(false);
const activeTab = ref<'chat' | 'sparql' | 'align' | 'stats' | 'ontology'>('chat');

// Load D3 graph network on mount
onMounted(async () => {
  try {
    const response = await fetch('/api/graph');
    const data = await response.json();
    graphData.value = data;
    
    // Auto select "文彭" (Wen Peng) node if available as default starting point
    const wenPeng = data.nodes.find((n: any) => n.id === 'ex:WenPeng');
    if (wenPeng) {
      selectedNode.value = wenPeng;
    }
  } catch (err) {
    console.error('Failed to resolve database graph nodes:', err);
  }
});

// Update selected node selection from graph emission
const selectNode = (node: GraphNode) => {
  selectedNode.value = node;
};

// Send message to the Agentic API
const handleSendMessage = async (text: string) => {
  const userMsg: ChatMessage = {
    id: 'user_' + Math.random().toString(36).substring(7),
    role: 'user',
    content: text,
    timestamp: new Date().toISOString()
  };

  const nextMessages = [...messages.value, userMsg];
  messages.value = nextMessages;
  loading.value = true;

  try {
    const response = await fetch('/api/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: text,
        history: messages.value.map(m => ({ role: m.role, content: m.content }))
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Q&A Agent error');
    }

    messages.value = [...nextMessages, data];
  } catch (err: any) {
    console.error('Error querying Q&A agent:', err);
    const errMsg: ChatMessage = {
      id: 'err_' + Math.random().toString(36).substring(7),
      role: 'assistant',
      content: `系统抱歉其在推演逻辑时偶遇障碍：${err.message}`,
      timestamp: new Date().toISOString()
    };
    messages.value = [...nextMessages, errMsg];
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen bg-[#F7F4EF] text-[#2D241E] flex flex-col font-sans select-none antialiased">
    <!-- Elegantly Crafted Scholar Header -->
    <header class="px-6 py-4 bg-[#412C1E] text-[#FCFAF7] shadow-md border-b border-[#2D241E] shrink-0">
      <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-[#8C2D19] flex items-center justify-center border border-[#AA3820] shadow-sm transform rotate-45 shrink-0 animate-fade-in">
            <Feather class="w-5 h-5 text-white transform -rotate-45" />
          </div>
          <div>
            <h1 class="text-xl md:text-2xl font-serif font-bold tracking-tight text-white flex items-center gap-2">
              <span>印人与历代书法家金石语义图谱问答系统 [Vue3]</span>
            </h1>
            <p class="text-[11px] text-[#C1B5A3] font-serif tracking-wide mt-0.5">
              基于金石古籍《印人传》· 跨越 CBDB 与 CTEXT 融合对齐 · 搭载大模型协同工作流之学术大成
            </p>
          </div>
        </div>

        <!-- Genuine Database Stat Indicators -->
        <div class="flex gap-4 text-xs font-mono text-[#DCD6CD] border-t md:border-t-0 border-[#5C5246] pt-3 md:pt-0 w-full md:w-auto justify-center">
          <div class="flex items-center gap-1.5">
            <Database class="w-3.5 h-3.5 text-[#C1B5A3]" />
            <span>载入三元组：<strong class="text-white">100+</strong></span>
          </div>
          <div class="flex items-center gap-1.5">
            <Clock class="w-3.5 h-3.5 text-[#C1B5A3]" />
            <span>涵盖朝代：<strong class="text-white">晋、唐、元、明、清</strong></span>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Workspace Frame -->
    <main class="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
      
      <!-- LEFT COLUMN: INTERACTIVE GRAPH CANVAS (5 cols) -->
      <div class="lg:col-span-5 flex flex-col gap-4 h-full min-h-[460px]">
        <div class="flex-1 h-full">
          <NetworkGraph 
            :data="graphData" 
            @select-node="selectNode" 
            :selected-node="selectedNode" 
          />
        </div>

        <!-- Selected Node Details Cabinet under graph -->
        <div v-if="selectedNode" class="p-4 bg-white border border-[#E9E4DC] rounded-xl shadow-xs space-y-3 font-serif animate-fade-in">
          <div class="border-b border-gray-100 pb-1.5 flex items-center justify-between">
            <div>
              <h3 class="text-base font-bold text-[#2D241E]">{{ selectedNode.label }}</h3>
              <span class="text-[10px] text-gray-400 font-mono">{{ selectedNode.id }}</span>
            </div>
            <span class="text-xs px-2.5 py-0.5 bg-[#F4EFE6] text-[#8C2D19] border border-[#E9E4DC] rounded-full font-serif font-bold">
              {{ selectedNode.type === 'Person' ? '金石人物' : selectedNode.type === 'School' ? '派门系列' : selectedNode.type === 'ScriptStyle' ? '书体印风' : '祖地籍地' }}
            </span>
          </div>

          <div v-if="selectedNode.dynasty" class="text-xs text-stone-600 font-sans">
            朝代归纳：<strong class="text-[#2D241E]">{{ selectedNode.dynasty }}</strong>
          </div>

          <p v-if="selectedNode.intro" class="text-[11.5px] text-gray-500 line-clamp-3 leading-relaxed font-sans">
            {{ selectedNode.intro }}
          </p>

          <div class="pt-1.5 border-t border-gray-50 flex gap-2">
            <button
              @click="activeTab = 'align'"
              class="px-3 py-1.5 text-[10.5px] font-sans font-medium hover:bg-[#FAF8F5] border border-[#E9E4DC] hover:border-[#8C2D19]/40 text-[#5C5246] hover:text-[#8C2D19] rounded-md transition-all duration-150 flex items-center gap-1 cursor-pointer"
            >
              <GitCompare class="w-3.5 h-3.5 text-[#8C2D19]" />
              <span>在异源传记融合对齐本中研读</span>
            </button>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: TAB WORKSPACE CONTROLLER (7 cols) -->
      <div class="lg:col-span-7 flex flex-col gap-4 h-full">
        <!-- Tab Selection Row -->
        <div class="flex flex-wrap gap-1 bg-[#E9E4DC] p-1 rounded-xl">
          <button
            @click="activeTab = 'chat'"
            :class="[
              'flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer font-sans',
              activeTab === 'chat' ? 'bg-[#8C2D19] text-white shadow-xs' : 'text-[#5C5246] hover:bg-white/40'
            ]"
          >
            <Sparkles class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">墨香AI智能问策</span>
            <span class="sm:hidden">智能问答</span>
          </button>

          <button
            @click="activeTab = 'stats'"
            :class="[
              'flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer font-sans',
              activeTab === 'stats' ? 'bg-[#8C2D19] text-white shadow-xs' : 'text-[#5C5246] hover:bg-white/40'
            ]"
          >
            <Cpu class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">图论与传承计算</span>
            <span class="sm:hidden">图论计算</span>
          </button>

          <button
            @click="activeTab = 'align'"
            :class="[
              'flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer font-sans',
              activeTab === 'align' ? 'bg-[#8C2D19] text-white shadow-xs' : 'text-[#5C5246] hover:bg-white/40'
            ]"
          >
            <GitCompare class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">跨库融合考证</span>
            <span class="sm:hidden">数据库对齐</span>
          </button>

          <button
            @click="activeTab = 'sparql'"
            :class="[
              'flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer font-sans',
              activeTab === 'sparql' ? 'bg-[#8C2D19] text-white shadow-xs' : 'text-[#5C5246] hover:bg-white/40'
            ]"
          >
            <FileCode class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">SPARQL 检索</span>
            <span class="sm:hidden">SPARQL</span>
          </button>

          <button
            @click="activeTab = 'ontology'"
            :class="[
              'flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer font-sans',
              activeTab === 'ontology' ? 'bg-[#8C2D19] text-white shadow-xs' : 'text-[#5C5246] hover:bg-white/40'
            ]"
          >
            <Database class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">语义本体规范</span>
            <span class="sm:hidden">本体</span>
          </button>
        </div>

        <!-- Active Tab Panel Body -->
        <div class="flex-1 overflow-y-auto">
          <div v-show="activeTab === 'chat'" class="h-full">
            <ChatPanel 
              :messages="messages" 
              @send-message="handleSendMessage" 
              :loading="loading" 
            />
          </div>

          <div v-if="activeTab === 'sparql'">
            <QueryPanel />
          </div>

          <div v-if="activeTab === 'align'">
            <DataBrowser />
          </div>

          <div v-if="activeTab === 'stats'">
            <GraphStructures />
          </div>

          <div v-if="activeTab === 'ontology'">
            <OntologySpec />
          </div>
        </div>
      </div>

    </main>

    <!-- Styled Humanistic Footer -->
    <footer class="px-6 py-3.5 bg-[#412C1E] border-t border-[#2D241E] text-[#C1B5A3] text-[10.5px] font-serif tracking-wide text-center shrink-0">
      <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>印谱问答系统 · 古典文献数字化金石学语义网系统示范</span>
        <span>© 1726 - 2026 《印人传》印学图谱数据融合委员会 · 敬呈</span>
      </div>
    </footer>
  </div>
</template>
