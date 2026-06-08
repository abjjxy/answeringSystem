<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import {
  Award,
  Footprints,
  Users,
  GitBranch,
  ArrowRight,
  ShieldAlert,
  Crown,
  Link2,
  Clock,
} from 'lucide-vue-next';
import type {
  CentralityScore,
  CommunityGroup,
  ShortestPathResult,
  SchoolAnalysisResult,
  GraphNode,
} from '../types';

interface Props {
  selectedNode?: GraphNode | null;
}

const props = defineProps<Props>();

type AnalysisTab = 'schools' | 'communities' | 'centrality' | 'paths';

const activeSection = ref<AnalysisTab>('schools');
const loading = ref(false);

const centralities = ref<CentralityScore[]>([]);
const communities = ref<CommunityGroup[]>([]);
const schools = ref<SchoolAnalysisResult | null>(null);

const sourcePerson = ref('ex:WenPeng');
const targetPerson = ref('ex:WuChangshuo');
const pathResult = ref<ShortestPathResult | null>(null);
const pathLoading = ref(false);

const sections = [
  { id: 'schools' as const, label: '流派分析', icon: GitBranch },
  { id: 'communities' as const, label: '社区发现', icon: Users },
  { id: 'centrality' as const, label: '中心性', icon: Award },
  { id: 'paths' as const, label: '路径分析', icon: Footprints },
];

const personCentralities = computed(() =>
  centralities.value.filter(c => c.type === 'Person')
);

const queryOptions = computed(() => {
  const fromGraph = personCentralities.value.map(c => ({ value: c.id, label: c.label }));
  if (fromGraph.length > 0) return fromGraph;
  return [
    { value: 'ex:WenZhengming', label: '文徵明' },
    { value: 'ex:WenPeng', label: '文彭' },
    { value: 'ex:HeZhen', label: '何震' },
    { value: 'ex:DingJing', label: '丁敬' },
    { value: 'ex:DengShiru', label: '邓石如' },
    { value: 'ex:WuChangshuo', label: '吴昌硕' },
  ];
});

const topCentralities = computed(() =>
  [...personCentralities.value]
    .sort((a, b) => b.betweennessCentrality - a.betweennessCentrality || b.degreeCentrality - a.degreeCentrality)
    .slice(0, 8)
);

const maxDegree = computed(() => Math.max(...topCentralities.value.map(c => c.degreeCentrality), 1));
const maxBetween = computed(() => Math.max(...topCentralities.value.map(c => c.betweennessCentrality), 1));

const fetchStats = async () => {
  loading.value = true;
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    centralities.value = data.centralities || [];
    communities.value = data.communities || [];
    schools.value = data.schools || null;
  } catch (err) {
    console.error('Failed to load graph analysis:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  if (props.selectedNode?.id) {
    sourcePerson.value = props.selectedNode.id;
  }
  fetchStats();
});

const handleTracePath = async () => {
  pathLoading.value = true;
  try {
    const response = await fetch('/api/path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: sourcePerson.value, target: targetPerson.value }),
    });
    pathResult.value = await response.json();
  } catch (err) {
    console.error('Failed to trace path:', err);
  } finally {
    pathLoading.value = false;
  }
};

const roleLabel = (c: CentralityScore) => {
  if (c.betweennessCentrality >= maxBetween.value * 0.6) return '枢纽人物';
  if (c.degreeCentrality >= maxDegree.value * 0.6) return '高连接节点';
  return '网络成员';
};
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden" id="graph_structures">
    <div class="px-4 py-2 border-b border-[#E9E4DC] bg-white shrink-0">
      <p class="text-[11px] text-gray-500 leading-relaxed">
        基于人物关系图谱的图论分析：流派核心与演变、师承交游社区、中心性指标与最短路径探索。
      </p>
    </div>

    <div class="flex border-b border-[#E9E4DC] bg-[#FAF8F5] shrink-0 overflow-x-auto">
      <button
        v-for="sec in sections"
        :key="sec.id"
        type="button"
        @click="activeSection = sec.id"
        :class="[
          'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer',
          activeSection === sec.id
            ? 'border-[#8C2D19] text-[#8C2D19] bg-white'
            : 'border-transparent text-[#998D80] hover:text-[#2D241E]'
        ]"
      >
        <component :is="sec.icon" class="w-3.5 h-3.5" />
        {{ sec.label }}
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FCFAF7]">
      <div v-if="loading" class="text-center py-12 text-xs text-gray-400">正在计算图结构指标…</div>

      <!-- 流派分析 -->
      <template v-else-if="activeSection === 'schools' && schools">
        <div class="grid grid-cols-1 gap-3">
          <div
            v-for="school in schools.schools"
            :key="school.schoolId"
            class="bg-white border border-[#E9E4DC] rounded-lg p-4 space-y-3"
          >
            <div class="flex items-start justify-between gap-2">
              <div>
                <h3 class="font-serif font-bold text-[#2D241E]">{{ school.schoolLabel }}</h3>
                <p class="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                  <Clock class="w-3 h-3" />
                  活跃时期：{{ school.period }} · {{ school.memberCount }} 人
                </p>
              </div>
              <span
                v-if="school.founder"
                class="shrink-0 text-[10px] px-2 py-1 bg-[#8C2D19]/10 text-[#8C2D19] rounded-full font-medium flex items-center gap-1"
              >
                <Crown class="w-3 h-3" />
                开创：{{ school.founder.label }}
              </span>
            </div>

            <div v-if="school.coreFigures.length" class="space-y-1">
              <div class="text-[10px] text-gray-500 font-medium">核心人物</div>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="fig in school.coreFigures"
                  :key="fig.id"
                  class="text-[10.5px] bg-[#F4EFE6] text-[#5C5246] px-2 py-0.5 rounded border border-[#E9E4DC]"
                >
                  {{ fig.label }}
                  <span v-if="fig.dynasty" class="text-gray-400">（{{ fig.dynasty }}）</span>
                </span>
              </div>
            </div>

            <div class="flex flex-wrap gap-1">
              <span
                v-for="m in school.members"
                :key="m.id"
                class="text-[10px] bg-white border border-[#E9E4DC] text-[#5C5246] px-1.5 py-0.5 rounded"
              >
                {{ m.label }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="schools.bridges.length" class="bg-white border border-[#E9E4DC] rounded-lg p-4 space-y-3 mt-1">
          <h3 class="text-sm font-bold text-[#2D241E] flex items-center gap-1.5">
            <Link2 class="w-4 h-4 text-[#8C2D19]" />
            流派间关联
          </h3>
          <div class="space-y-2">
            <div
              v-for="(bridge, i) in schools.bridges"
              :key="i"
              class="text-xs flex flex-wrap items-center gap-1.5 p-2.5 bg-[#FAF8F5] rounded-lg border border-[#E9E4DC]/60"
            >
              <span class="font-serif font-bold text-[#2D241E]">{{ bridge.personA }}</span>
              <span class="text-[10px] text-gray-400">（{{ bridge.schoolA }}）</span>
              <span class="text-[#8C2D19] text-[10px] px-1.5 py-0.5 bg-white rounded border border-[#E9E4DC]">
                {{ bridge.relation }}
              </span>
              <span class="font-serif font-bold text-[#2D241E]">{{ bridge.personB }}</span>
              <span class="text-[10px] text-gray-400">（{{ bridge.schoolB }}）</span>
            </div>
          </div>
        </div>
      </template>

      <!-- 社区发现 -->
      <template v-else-if="activeSection === 'communities'">
        <p class="text-[11px] text-gray-500 -mt-1">
          基于师承、交游与流派归属关系，将印人划分为相互关联的人物群体。
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            v-for="comm in communities"
            :key="comm.communityId"
            class="bg-white border border-[#E9E4DC] rounded-lg p-3.5 space-y-2.5"
          >
            <div class="flex items-center justify-between">
              <span class="text-sm font-serif font-bold text-[#8C2D19]">{{ comm.leader }}</span>
              <span class="text-[10px] text-gray-500">{{ comm.members.length }} 人</span>
            </div>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="member in comm.members"
                :key="member.id"
                class="text-[10.5px] bg-[#FAF8F5] border border-[#E9E4DC] text-[#5C5246] px-2 py-0.5 rounded"
              >
                {{ member.label }}
              </span>
            </div>
          </div>
        </div>
      </template>

      <!-- 中心性分析 -->
      <template v-else-if="activeSection === 'centrality'">
        <p class="text-[11px] text-gray-500 -mt-1">
          度中心性衡量直接关联数量；介数中心性衡量人物作为传承桥梁的频率。
        </p>
        <div class="bg-white border border-[#E9E4DC] rounded-lg overflow-hidden">
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-[#FAF8F5] text-[#998D80] text-left text-[10px]">
                <th class="px-3 py-2 font-medium">人物</th>
                <th class="px-3 py-2 font-medium text-center w-24">度中心性</th>
                <th class="px-3 py-2 font-medium text-center w-24">介数中心性</th>
                <th class="px-3 py-2 font-medium w-20">角色</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-100">
              <tr v-for="c in topCentralities" :key="c.id" class="hover:bg-amber-50/30">
                <td class="px-3 py-2.5 font-serif font-bold text-[#2D241E]">{{ c.label }}</td>
                <td class="px-3 py-2.5">
                  <div class="flex items-center gap-2 justify-center">
                    <div class="w-12 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        class="h-full bg-[#412C1E] rounded-full"
                        :style="{ width: `${(c.degreeCentrality / maxDegree) * 100}%` }"
                      />
                    </div>
                    <span class="font-mono text-[10px] w-4 text-right">{{ c.degreeCentrality }}</span>
                  </div>
                </td>
                <td class="px-3 py-2.5">
                  <div class="flex items-center gap-2 justify-center">
                    <div class="w-12 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        class="h-full bg-[#8C2D19] rounded-full"
                        :style="{ width: `${(c.betweennessCentrality / maxBetween) * 100}%` }"
                      />
                    </div>
                    <span class="font-mono text-[10px] w-6 text-right text-[#8C2D19]">{{ c.betweennessCentrality }}</span>
                  </div>
                </td>
                <td class="px-3 py-2.5 text-[10px] text-gray-500">{{ roleLabel(c) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- 路径分析 -->
      <template v-else-if="activeSection === 'paths'">
        <p class="text-[11px] text-gray-500 -mt-1">
          在师承与交游关系网络中，探索两位印人之间的最短传承或交往路径。
        </p>
        <div class="bg-white border border-[#E9E4DC] rounded-lg p-4 space-y-4">
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label class="block text-gray-500 mb-1">起点人物</label>
              <select
                v-model="sourcePerson"
                class="w-full p-2 bg-stone-50 border border-[#E9E4DC] rounded-md text-[#2D241E] focus:outline-none focus:border-[#8C2D19]"
              >
                <option v-for="opt in queryOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
            <div>
              <label class="block text-gray-500 mb-1">终点人物</label>
              <select
                v-model="targetPerson"
                class="w-full p-2 bg-stone-50 border border-[#E9E4DC] rounded-md text-[#2D241E] focus:outline-none focus:border-[#8C2D19]"
              >
                <option v-for="opt in queryOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            @click="handleTracePath"
            :disabled="pathLoading"
            class="w-full py-2.5 bg-[#8C2D19] hover:bg-[#6E2213] disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
          >
            {{ pathLoading ? '计算中…' : '探索最短路径' }}
          </button>

          <div v-if="pathResult" class="p-3.5 bg-[#FAF8F5] border border-[#E9E4DC] rounded-lg space-y-2">
            <template v-if="pathResult.found">
              <div class="text-xs text-gray-500 flex justify-between">
                <span>路径已找到</span>
                <span class="text-[#8C2D19] font-bold">{{ pathResult.edges.length }} 跳</span>
              </div>
              <div class="flex flex-col gap-1.5">
                <template v-for="(node, i) in pathResult.path" :key="i">
                  <div class="flex items-center gap-2">
                    <span class="w-5 h-5 rounded-full bg-[#8C2D19]/10 text-[#8C2D19] text-[10px] font-bold flex items-center justify-center border border-[#8C2D19]/20">
                      {{ i + 1 }}
                    </span>
                    <span class="font-serif font-bold text-sm text-[#2D241E]">{{ node }}</span>
                  </div>
                  <div
                    v-if="i < pathResult.path.length - 1"
                    class="pl-2.5 py-0.5 border-l border-dashed border-[#8C2D19] ml-2.5 flex items-center gap-1 text-[10px] text-[#8C2D19]"
                  >
                    <ArrowRight class="w-3 h-3" />
                    {{ pathResult.edges[i]?.relation || '关联' }}
                  </div>
                </template>
              </div>
            </template>
            <div v-else class="text-xs text-rose-600 flex items-center gap-1.5">
              <ShieldAlert class="w-4 h-4 shrink-0" />
              两人之间暂无师承或交游路径连通。
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
