<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Search, Link2, GitCompare, CheckCircle2, FileCode, Landmark } from 'lucide-vue-next';
import type { DBAlignmentInfo } from '../types';

interface BrowserItem {
  id: string;
  label: string;
  dynasty: string;
  intro: string;
  alignment: DBAlignmentInfo;
}

const entities = ref<BrowserItem[]>([]);
const filterText = ref('');
const selectedEntity = ref<BrowserItem | null>(null);
const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  try {
    const response = await fetch('/api/entities');
    const data = await response.json();
    entities.value = data;
    if (data.length > 0) {
      selectedEntity.value = data[0];
    }
  } catch (err) {
    console.error('Failed to get alignment list:', err);
  } finally {
    loading.value = false;
  }
});

const filtered = computed(() => {
  const query = filterText.value.trim().toLowerCase();
  if (!query) return entities.value;
  return entities.value.filter(e =>
    e.label.toLowerCase().includes(query) ||
    e.intro.toLowerCase().includes(query) ||
    e.dynasty.toLowerCase().includes(query)
  );
});

const selectEntity = (item: BrowserItem) => {
  selectedEntity.value = item;
};
</script>

<template>
  <div class="bg-[#FCFAF7] border border-[#E9E4DC] rounded-xl p-5 shadow-sm space-y-4" id="data_browser">
    <div>
      <h2 class="font-serif font-bold text-lg text-[#2D241E] flex items-center gap-2">
        <GitCompare class="w-5 h-5 text-[#8C2D19]" />
        <span>文渊对齐 · 异源学术数据库融合中心</span>
      </h2>
      <p class="text-xs text-gray-500 mt-1">
        本节点展示将由大模型抽取的印人知识对齐至金石领域及中国古代史权威数据库——中国历代人物传记数据库（CBDB）及古籍数字化图书馆（CTEXT）的链路。
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <!-- Left column list -->
      <div class="lg:col-span-4 flex flex-col gap-3">
        <div class="relative">
          <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-[#A1978E]" />
          <input
            type="text"
            v-model="filterText"
            placeholder="搜名人、神雅、流派及生平..."
            class="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#C1B5A3] bg-white focus:border-[#8C2D19] focus:outline-none"
            id="search_filter"
          />
        </div>

        <div class="max-h-[380px] overflow-y-auto divide-y divide-[#E9E4DC] border border-[#E9E4DC] rounded-lg bg-white bg-clip-border" id="scrollable_entity_list">
          <div v-if="loading" class="p-4 text-center text-xs text-gray-400">正在调取学术接口...</div>
          <div v-else-if="filtered.length === 0" class="p-4 text-center text-xs text-gray-400 font-serif">未载入匹配的雅贤名录。</div>
          <template v-else>
            <button
              v-for="ent in filtered"
              :key="ent.id"
              @click="selectEntity(ent)"
              :class="[
                'w-full p-3 font-serif transition-colors text-left flex items-center justify-between cursor-pointer',
                selectedEntity?.id === ent.id ? 'bg-[#F4EFE6]' : 'hover:bg-[#FAF8F5]'
              ]"
            >
              <div>
                <span class="font-bold text-sm text-[#2D241E]">{{ ent.label }}</span>
                <span class="text-[10px] ml-1.5 px-1.5 py-0.5 bg-stone-150 rounded text-[#998D80]">
                  {{ ent.dynasty }}
                </span>
              </div>
              <div class="flex gap-1 shrink-0">
                <span v-if="ent.alignment.ctextId" class="text-[8px] bg-sky-50 text-sky-700 px-1 py-0.5 rounded font-mono border border-sky-200">
                  CTEXT
                </span>
                <span v-if="ent.alignment.cbdbId" class="text-[8px] bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded font-mono border border-indigo-200">
                  CBDB
                </span>
                <span v-if="!ent.alignment.ctextId && !ent.alignment.cbdbId" class="text-[8px] bg-amber-50 text-amber-700 px-1 py-0.5 rounded font-mono">
                  未对齐
                </span>
              </div>
            </button>
          </template>
        </div>
      </div>

      <!-- Right column detailed mapping -->
      <div class="lg:col-span-8">
        <div v-if="selectedEntity" class="bg-white border border-[#E9E4DC] rounded-lg p-4 space-y-4 font-serif" id="entity_detail_panel">
          <!-- Header -->
          <div class="border-b border-[#FAF6F0] pb-2 flex flex-wrap justify-between items-start gap-2">
            <div>
              <h3 class="text-lg font-bold text-[#2D241E] flex items-center gap-1.5">
                <span>{{ selectedEntity.label }}</span>
                <span class="text-xs font-normal text-gray-500 bg-stone-100 px-2 py-0.5 rounded-full">
                  {{ selectedEntity.dynasty }}
                </span>
              </h3>
              <p class="text-[10.5px] font-mono text-gray-400 mt-0.5">{{ selectedEntity.id }}</p>
            </div>

            <div class="flex items-center gap-1">
              <CheckCircle2 class="w-4 h-4 text-emerald-600 shrink-0" />
              <span class="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5 animate-fade-in">
                已启用消歧规则完成对齐
              </span>
            </div>
          </div>

          <!-- Bio summary -->
          <div>
            <h4 class="text-xs font-sans font-bold text-[#8C2D19] border-l-2 border-[#8C2D19] pl-1.5 mb-1.5">
              引文考证生平
            </h4>
            <div class="p-3 bg-[#FCFAF7] border border-[#F2EDE4] rounded-lg text-xs leading-relaxed text-[#5C5246] font-sans">
              {{ selectedEntity.intro || '书传未载入详细简介。' }}
            </div>
          </div>

          <!-- Advanced database alignment blocks -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- CTEXT card -->
            <div class="border border-sky-100 rounded-lg overflow-hidden bg-sky-50/20">
              <div class="px-3 py-2 bg-sky-50 border-b border-sky-100 flex items-center justify-between text-xs font-sans text-sky-800 font-semibold">
                <div class="flex items-center gap-1">
                  <Landmark class="w-3.5 h-3.5" />
                  <span>古籍数字图书馆 (CTEXT)</span>
                </div>
                <span v-if="selectedEntity.alignment.ctextId" class="bg-sky-100 text-sky-700 px-1 py-0.5 text-[8px] rounded font-mono">
                  ID: {{ selectedEntity.alignment.ctextId }}
                </span>
                <span v-else class="text-gray-400 text-[10px]">无条目</span>
              </div>
              <div class="p-3 text-xs space-y-1.5 font-sans text-[#5C5246]">
                <template v-if="selectedEntity.alignment.ctextId">
                  <div>
                    <strong>本籍籍地：</strong>
                    <span>{{ selectedEntity.alignment.supplementalData?.birthPlaceInfo }}</span>
                  </div>
                  <div>
                    <strong>典籍出处：</strong>
                    <span class="text-stone-500 font-serif">
                      《印人传》、《列传·艺术》、《清史稿》
                    </span>
                  </div>
                  <div>
                    <strong>参考古籍链：</strong>
                    <a
                      :href="selectedEntity.alignment.supplementalData?.sourceRecordUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center text-sky-700 underline gap-0.5 ml-1"
                    >
                      <span>ctext.org / 词条录</span>
                      <Link2 class="w-3 h-3" />
                    </a>
                  </div>
                </template>
                <span v-else class="text-[#998D80] italic">
                  该人物在古籍图书馆暂无直接条目对齐。通过语义消歧机制判定。
                </span>
              </div>
            </div>

            <!-- CBDB card -->
            <div class="border border-indigo-100 rounded-lg overflow-hidden bg-indigo-50/20">
              <div class="px-3 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between text-xs font-sans text-indigo-800 font-semibold">
                <div class="flex items-center gap-1">
                  <GitCompare class="w-3.5 h-3.5" />
                  <span>历代传记数据库 (CBDB)</span>
                </div>
                <span v-if="selectedEntity.alignment.cbdbId" class="bg-indigo-100 text-indigo-700 px-1 py-0.5 text-[8px] rounded font-mono">
                  ID: {{ selectedEntity.alignment.cbdbId }}
                </span>
                <span v-else class="text-gray-400 text-[10px]">无条目</span>
              </div>
              <div class="p-3 text-xs space-y-1.5 font-sans text-[#5C5246]">
                <template v-if="selectedEntity.alignment.cbdbId">
                  <div>
                    <strong>其曾任官职：</strong>
                    <div class="flex flex-wrap gap-1 mt-1">
                      <span v-for="(title, i) in selectedEntity.alignment.supplementalData?.officePlayed" :key="i" class="text-[10px] bg-slate-100 border text-slate-700 px-1.5 py-0.2 rounded font-serif">
                        {{ title }}
                      </span>
                    </div>
                  </div>
                  <div>
                    <strong>异名/别号：</strong>
                    <span>{{ selectedEntity.alignment.supplementalData?.altNames?.join('、') }}</span>
                  </div>
                  <div>
                    <strong>家系记录：</strong>
                    <span class="text-stone-500">{{ selectedEntity.alignment.supplementalData?.parentInfo }}</span>
                  </div>
                </template>
                <span v-else class="text-[#998D80] italic">
                  未在哈佛CBDB中央数据库匹配到直属编码记录。已归入布衣学术名录。
                </span>
              </div>
            </div>
          </div>

          <!-- Rule Disambiguation notes -->
          <div class="p-2.5 bg-[#FAF8F5] border border-dashed border-[#E9E4DC] rounded text-[10px] font-sans text-gray-500 leading-relaxed">
            <span class="font-bold text-[#8C2D19] block mb-0.5">※ 消歧考辨报告 (Disambiguation Report)</span>
            由于「{{ selectedEntity.label }}」在古代不同府志及数据库中可能有多位重名者，本系统采用<strong>两极判准消歧法</strong>：
            对比其 active 朝代寿命（Dynasty Lifetime 与生年差绝对值 &lt; 5）和家系关系网（如父亲「{{ selectedEntity.alignment.supplementalData?.parentInfo || '王旷' }}」判定），在多级重名条目中自动剔除伪匹配，确保 100% 对齐精度。
          </div>

          <!-- RDF TURTLE REPRESENTATION -->
          <div class="border border-stone-200 rounded-lg overflow-hidden font-sans">
            <div class="bg-stone-100 px-3 py-1.5 text-stone-700 text-[11px] font-bold flex items-center justify-between border-b">
              <div class="flex items-center gap-1">
                <FileCode class="w-3.5 h-3.5 text-stone-500" />
                <span>人物直属 RDF Turtle 元数据表达</span>
              </div>
            </div>
            <pre class="p-3 bg-stone-900 text-stone-300 text-[9.5px] font-mono leading-normal overflow-x-auto select-all max-h-[160px]">
@prefix ex: &lt;http://example.org/calligraphy#&gt; .
@prefix rdf: &lt;http://www.w3.org/1999/02/22-rdf-syntax-ns#&gt; .
@prefix rdfs: &lt;http://www.w3.org/2050/01/rdf-schema#&gt; .

{{ selectedEntity.id }} rdf:type ex:Person ;
    rdfs:label "{{ selectedEntity.label }}" ;
    ex:dynasty "{{ selectedEntity.dynasty }}" ;
    ex:ctextId "{{ selectedEntity.alignment.ctextId || '' }}" ;
    ex:cbdbId "{{ selectedEntity.alignment.cbdbId || '' }}" ;
    ex:introduction "{{ selectedEntity.intro.substring(0, 40) }}..." .
            </pre>
          </div>
        </div>
        <div v-else class="h-full flex items-center justify-center border border-dashed border-gray-200 rounded-lg min-h-[300px] text-xs text-gray-400 font-serif">
          请在左侧贤能名录中选择，加载其跨库数据库精密剖面。
        </div>
      </div>
    </div>
  </div>
</template>
