<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Award, ShieldAlert, Footprints, Network, Cpu, ArrowRight } from 'lucide-vue-next';
import type { CentralityScore, CommunityGroup, ShortestPathResult } from '../types';

const stats = ref<{ centralities: CentralityScore[]; communities: CommunityGroup[] } | null>(null);
const loading = ref(false);

const sourcePerson = ref('ex:WenPeng');
const targetPerson = ref('ex:WuChangshuo');
const pathResult = ref<ShortestPathResult | null>(null);
const pathLoading = ref(false);

const queryOptions = [
  { value: 'ex:WangXizhi', label: '王羲之 (书圣)' },
  { value: 'ex:YanZhenqing', label: '颜真卿' },
  { value: 'ex:ZhaoMengfu', label: '赵孟頫' },
  { value: 'ex:WenZhengming', label: '文徵明' },
  { value: 'ex:WenPeng', label: '文彭' },
  { value: 'ex:HeZhen', label: '何震' },
  { value: 'ex:ZhuJian', label: '朱简' },
  { value: 'ex:DingJing', label: '丁敬 (浙派鼻祖)' },
  { value: 'ex:DengShiru', label: '邓石如 (完白山人)' },
  { value: 'ex:WuXizai', label: '吴熙载 (让之)' },
  { value: 'ex:ZhaoZhiqian', label: '赵之谦' },
  { value: 'ex:WuChangshuo', label: '吴昌硕 (缶老)' },
];

const fetchStats = async () => {
  loading.value = true;
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    stats.value = data;
  } catch (err) {
    console.error('Failed to resolve network stats:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchStats();
});

const handleTracePath = async () => {
  pathLoading.value = true;
  try {
    const response = await fetch('/api/path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: sourcePerson.value, target: targetPerson.value })
    });
    const data = await response.json();
    pathResult.value = data;
  } catch (err) {
    console.error('Failed to trace network path:', err);
  } finally {
    pathLoading.value = false;
  }
};
</script>

<template>
  <div class="bg-[#FCFAF7] border border-[#E9E4DC] rounded-xl p-5 shadow-sm space-y-5" id="graph_structures">
    <div>
      <h2 class="font-serif font-bold text-lg text-[#2D241E] flex items-center gap-2">
        <Network class="w-5 h-5 text-[#8C2D19]" />
        <span>金石学者图论及多维结构计算中心</span>
      </h2>
      <p class="text-xs text-gray-500 mt-1">
        本舱室应用图论算理研究《印人传》之人物网络。包含：基于最短路径的师承交游拓扑、度与介数中心性（Betweenness Centrality）权威权重计算、以及各流派社区演变发现。
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <!-- Shortest Path workspace -->
      <div class="border border-[#E9E4DC] rounded-lg p-4 bg-white space-y-4 font-serif">
        <h3 class="text-sm font-bold text-[#8C2D19] border-b pb-2 flex items-center gap-1.5 font-sans">
          <Footprints class="w-4 h-4 text-[#8C2D19]" />
          <span>师承金石脉络探幽 (Shortest Relationship Paths)</span>
        </h3>

        <div class="grid grid-cols-2 gap-3 text-xs font-sans">
          <div>
            <label class="block text-gray-500 mb-1">寻路起点（贤家甲）</label>
            <select
              v-model="sourcePerson"
              class="w-full p-2 bg-stone-50 border rounded-md text-[#2D241E] focus:outline-none focus:border-[#8C2D19]"
            >
              <option v-for="opt in queryOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <div>
            <label class="block text-gray-500 mb-1">寻路终点（贤家乙）</label>
            <select
              v-model="targetPerson"
              class="w-full p-2 bg-stone-50 border rounded-md text-[#2D241E] focus:outline-none focus:border-[#8C2D19]"
              id="target_selector"
            >
              <option v-for="opt in queryOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
        </div>

        <button
          @click="handleTracePath"
          :disabled="pathLoading"
          class="w-full py-2.5 bg-[#8C2D19] hover:bg-[#6E2213] text-white text-xs font-sans font-medium rounded-lg shadow-sm transition-colors cursor-pointer"
          id="btn_trace_path"
        >
          {{ pathLoading ? '图论矩阵求解中...' : '求解并绘制最短传承路径' }}
        </button>

        <!-- Path Trace Draw results -->
        <div v-if="pathResult" class="p-3.5 bg-[#FAF8F5] border border-[#E9E4DC] rounded-lg space-y-3 font-sans" id="path_trace_results">
          <template v-if="pathResult.found">
            <div class="text-xs text-gray-500 flex items-center justify-between">
              <span>寻路成功 (Path Discovered)</span>
              <span class="text-[#8C2D19] font-bold">跳数：{{ pathResult.edges.length }} 跳</span>
            </div>
            <!-- node to node visual lines -->
            <div class="flex flex-col gap-2">
              <template v-for="(node, i) in pathResult.path" :key="i">
                <div class="flex items-center gap-2">
                  <span class="w-5 h-5 rounded-full bg-[#8C2D19]/10 text-[#8C2D19] text-[10px] font-bold flex items-center justify-center border border-[#8C2D19]/20 font-serif">
                    {{ i + 1 }}
                  </span>
                  <span class="font-serif font-bold text-sm text-[#2D241E]">{{ node }}</span>
                </div>
                <div v-if="i < pathResult.path.length - 1" class="pl-2.5 py-0.5 border-l border-dashed border-[#8C2D19] ml-2.5 flex items-center gap-1.5 text-[10px] text-[#8C2D19] font-medium leading-none.5">
                  <ArrowRight class="w-3 h-3 shrink-0" />
                  <span>传承连结: {{ pathResult.edges[i]?.relation || '交游' }}</span>
                </div>
              </template>
            </div>
          </template>
          <div v-else class="text-xs text-rose-600 font-medium py-2 flex items-center gap-1.5">
            <ShieldAlert class="w-4 h-4" />
            <span>在此二人之间暂无可见的师承或交游路线直接连通。图谱外亦无直接链条。</span>
          </div>
        </div>
      </div>

      <!-- Centrality ranking board -->
      <div class="border border-[#E9E4DC] rounded-lg p-4 bg-white space-y-4">
        <h3 class="text-sm font-bold text-[#8C2D19] border-b pb-2 flex items-center gap-1.5 font-sans">
          <Award class="w-4 h-4 text-[#8C2D19]" />
          <span>贤人图论影响力权值榜单 (Centrality Metric Rankings)</span>
        </h3>

        <div class="overflow-x-auto" id="centrality_board_holder">
          <div v-if="loading" class="text-center py-6 text-xs text-gray-400">正在计算拉普拉斯矩阵值...</div>
          <table v-else-if="stats" class="min-w-full divide-y divide-gray-100 text-xs">
            <thead>
              <tr class="text-[#998D80] text-left text-[10px] font-bold tracking-wider uppercase bg-[#FAF8F5]">
                <th class="px-3 py-1.5">人物名称</th>
                <th class="px-3 py-1.5 text-center">度中心性 (Degree)</th>
                <th class="px-3 py-1.5 text-center">介数中心性 (Betweenness)</th>
                <th class="px-3 py-1.5">分析判定</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-50 text-gray-700">
              <tr v-for="(c, i) in stats.centralities.slice(0, 7)" :key="i" class="hover:bg-amber-50/20 transition-colors">
                <td class="px-3 py-2 font-serif font-bold text-[#2D241E]">{{ c.label }}</td>
                <td class="px-3 py-2 text-center font-mono font-medium">{{ c.degreeCentrality }}</td>
                <td class="px-3 py-2 text-center font-mono font-bold text-[#8C2D19]">{{ c.betweennessCentrality }}</td>
                <td class="px-3 py-2 text-stone-500 scale-95 origin-left text-[10px]">
                  {{ c.betweennessCentrality > 10 ? '核心枢纽 (Bridge)' : c.degreeCentrality >= 5 ? '高度集权 (Hub)' : '专业叶节点' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="text-[10px] text-gray-400 font-sans leading-relaxed pt-1.5 border-t border-gray-100">
          * <strong>介数中心性 (Betweenness Centrality)</strong> 计算：衡量每个人处于所有最短金石传承链条中间人的概率，值越高说明该节点作为中介传承起到了承前启后、跨流派汇通的作用。如<strong>文彭</strong>及<strong>丁敬</strong>其介数极高，验证其文人印学宗师之卓越地位。
        </div>
      </div>
    </div>

    <!-- Community cluster rows -->
    <div class="border border-[#E9E4DC] rounded-lg p-4 bg-white space-y-3">
      <h3 class="text-sm font-bold text-[#8C2D19] border-b pb-2 flex items-center gap-1.5">
        <Cpu class="w-4 h-4 text-[#8C2D19]" />
        <span>传承流派划分社区 (Aesthetic School Modular Communities)</span>
      </h3>

      <div v-if="loading" class="text-center py-4 text-xs text-gray-400">正在发掘社交圈...</div>
      <div v-else-if="stats" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="community_rows_grid">
        <div v-for="comm in stats.communities" :key="comm.communityId" class="border border-[#FAF6F0] rounded-lg bg-[#FAF8F5] p-3 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-serif font-bold text-[#2D241E]">{{ comm.leader }}</span>
            <span class="text-[9px] px-2 py-0.5 bg-stone-250 text-gray-600 rounded-full font-bold">
              {{ comm.members.length }} 位贤哲
            </span>
          </div>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="member in comm.members"
              :key="member.id"
              class="text-[10.5px] bg-white border border-[#E9E4DC] text-[#5C5246] px-2 py-0.5 rounded font-medium"
            >
              {{ member.label }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
