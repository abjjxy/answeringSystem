<script setup lang="ts">
import { Network, BarChart3 } from 'lucide-vue-next';
import NetworkGraph from './NetworkGraph.vue';
import GraphStructures from './GraphStructures.vue';
import type { GraphData, GraphNode } from '../types';

interface Props {
  data: GraphData;
  selectedNode: GraphNode | null;
}

defineProps<Props>();
const emit = defineEmits<{
  (e: 'selectNode', node: GraphNode): void;
}>();

const activeTab = defineModel<'graph' | 'analysis'>('activeTab', { default: 'graph' });
</script>

<template>
  <div class="flex flex-col h-full bg-[#FCFAF7] border border-[#E9E4DC] rounded-xl shadow-sm overflow-hidden">
    <div class="px-4 py-2.5 bg-[#F4EFE6] border-b border-[#E9E4DC] flex items-center justify-between gap-3 shrink-0">
      <span class="text-xs font-medium text-[#5C5246]">金石关系拓扑层</span>
      <div class="flex rounded-lg border border-[#E9E4DC] bg-white p-0.5 text-[11px]">
        <button
          type="button"
          @click="activeTab = 'graph'"
          :class="[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer',
            activeTab === 'graph' ? 'bg-[#8C2D19] text-white shadow-sm' : 'text-[#5C5246] hover:bg-[#FAF7F2]'
          ]"
        >
          <Network class="w-3.5 h-3.5" />
          <span>关系图谱</span>
        </button>
        <button
          type="button"
          @click="activeTab = 'analysis'"
          :class="[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer',
            activeTab === 'analysis' ? 'bg-[#8C2D19] text-white shadow-sm' : 'text-[#5C5246] hover:bg-[#FAF7F2]'
          ]"
        >
          <BarChart3 class="w-3.5 h-3.5" />
          <span>结构分析</span>
        </button>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-hidden">
      <NetworkGraph
        v-if="activeTab === 'graph'"
        class="h-full"
        :data="data"
        :selected-node="selectedNode"
        @select-node="emit('selectNode', $event)"
      />
      <GraphStructures
        v-else
        class="h-full"
        :selected-node="selectedNode"
      />
    </div>
  </div>
</template>
