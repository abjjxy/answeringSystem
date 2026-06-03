<script setup lang="ts">
import { ref } from 'vue';
import { Play, FileCode, CheckCircle, AlertOctagon, HelpCircle } from 'lucide-vue-next';
import type { SPARQLResult } from '../types';

const queryString = ref(`SELECT ?personLabel ?birth ?dynasty WHERE {
  ?person rdf:type ex:Person .
  ?person ex:dynasty "Ming" .
  ?person ex:birthYear ?birth .
  ?person rdfs:label ?personLabel .
  FILTER(?birth > 1500)
}`);

const loading = ref(false);
const result = ref<SPARQLResult | null>(null);
const error = ref<string | null>(null);

const templates = [
  {
    title: '明代金石家及生年',
    query: `SELECT ?name ?birth ?intro WHERE {
  ?person rdf:type ex:Person .
  ?person ex:dynasty "Ming" .
  ?person ex:birthYear ?birth .
  ?person rdfs:label ?name .
  ?person ex:introduction ?intro .
}`
  },
  {
    title: '人物学徒及其流派归宗',
    query: `SELECT ?master ?disciple ?school WHERE {
  ?person rdf:type ex:Person .
  ?person ex:teacherOf ?student .
  ?person rdfs:label ?master .
  ?student rdfs:label ?disciple .
  ?student ex:schoolMemberOf ?group .
  ?group rdfs:label ?school .
}`
  },
  {
    title: '擅长篆隶艺术大师名录',
    query: `SELECT ?name ?dynasty ?style WHERE {
  ?person ex:practicedStyle ex:SealScript .
  ?person rdfs:label ?name .
  ?person ex:dynasty ?dynasty .
  ?person ex:practicedStyle ?st .
  ?st rdfs:label ?style .
}`
  },
  {
    title: '祖地跨地域金石交往检索',
    query: `SELECT ?personA ?personB ?nativeA ?nativeB WHERE {
  ?pA ex:interactedWith ?pB .
  ?pA rdfs:label ?personA .
  ?pB rdfs:label ?personB .
  ?pA ex:nativePlace ?locA .
  ?pB ex:nativePlace ?locB .
  ?locA rdfs:label ?nativeA .
  ?locB rdfs:label ?nativeB .
}`
  }
];

const handleQuery = async () => {
  loading.value = true;
  error.value = null;
  result.value = null;

  try {
    const response = await fetch('/api/sparql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: queryString.value })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || 'SPARQL查询解析失准');
    }

    result.value = data;
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const useTemplate = (queryText: string) => {
  queryString.value = queryText;
};
</script>

<template>
  <div class="bg-[#FCFAF7] border border-[#E9E4DC] rounded-xl p-5 shadow-sm space-y-5" id="query_panel">
    <div>
      <h2 class="font-serif font-bold text-lg text-[#2D241E] flex items-center gap-2">
        <FileCode class="w-5 h-5 text-[#8C2D19]" />
        <span>RDF / SPARQL 语义高级查询工作台</span>
      </h2>
      <p class="text-xs text-gray-500 mt-1">
        直连在内存中运行的 Turtle 图谱存储器。您可以使用标准 SPARQL 语言，基于类声明、属性路径及 FILTER 节点进行精确的交叉过滤与逻辑连结。
      </p>
    </div>

    <!-- Select predefined templates -->
    <div class="space-y-1.5">
      <span class="text-[10px] font-bold text-[#8C2D19] tracking-wider uppercase">语义检索模板双击装载</span>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="(tpl, i) in templates"
          :key="i"
          @click="useTemplate(tpl.query)"
          class="px-2.5 py-1.5 bg-white hover:bg-[#F4EFE6] border border-[#E9E4DC] hover:border-[#8C2D19]/40 text-[#5C5246] hover:text-[#2D241E] rounded-md text-[11px] font-medium transition-all duration-150 cursor-pointer"
        >
          {{ tpl.title }}
        </button>
      </div>
    </div>

    <!-- Editor & Instructions -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <!-- Editor component -->
      <div class="lg:col-span-3 flex flex-col gap-2">
        <textarea
          v-model="queryString"
          class="w-full min-h-[160px] max-h-[300px] p-3 text-xs font-mono rounded-lg border border-[#C1B5A3] bg-white text-gray-800 focus:border-[#8C2D19] focus:outline-none focus:ring-1 focus:ring-[#8C2D19]"
          id="query_textarea"
        />
        <button
          @click="handleQuery"
          :disabled="loading"
          class="w-full md:w-auto self-end px-5 py-2.5 bg-[#8C2D19] hover:bg-[#6E2213] disabled:bg-gray-400 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          id="btn_execute_sparql"
        >
          <span v-if="loading" class="inline-block animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
          <Play v-else class="w-3.5 h-3.5" />
          <span>编译并执行查询 (SPARQL)</span>
        </button>
      </div>

      <!-- Custom ontology cheat sheets -->
      <div class="lg:col-span-1 p-3 bg-[#FAF8F5] border border-[#E9E4DC] rounded-lg text-[10px] text-[#5C5246] space-y-2 leading-relaxed">
        <div class="font-bold border-b border-[#E9E4DC] pb-1 text-[#8C2D19] flex items-center gap-1">
          <HelpCircle class="w-3.5 h-3.5" />
          <span>本体说明书</span>
        </div>
        <div class="space-y-1.5">
          <div>
            <strong class="text-gray-700">默认前缀 (省略亦支持解释)：</strong>
            <div class="font-mono text-gray-500 bg-white/70 p-1 border rounded mt-0.5">ex: (http://example.org/...)</div>
          </div>
          <div>
            <strong class="text-gray-700">主要实体概念：</strong>
            <ul class="list-disc pl-3.5 text-gray-500 mt-0.5">
              <li><code class="font-mono">ex:Person</code> : 历史文人/印家</li>
              <li><code class="font-mono">ex:School</code> : 艺术门派流派</li>
              <li><code class="font-mono">ex:ScriptStyle</code> : 书体风格</li>
            </ul>
          </div>
          <div>
            <strong class="text-gray-700">关系路径断言：</strong>
            <ul class="list-disc pl-3.5 text-gray-500 mt-0.5">
              <li>字号：<code class="font-mono">ex:zi</code>, <code class="font-mono">ex:hao</code></li>
              <li>姻传：<code class="font-mono">ex:father</code>, <code className="font-mono">ex:child</code></li>
              <li>师承：<code class="font-mono">ex:studentOf</code>, <code class="font-mono">ex:teacherOf</code></li>
              <li>交游：<code class="font-mono">ex:interactedWith</code></li>
              <li>风格：<code class="font-mono">ex:practicedStyle</code></li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Result presentation area -->
    <div v-if="result || error" class="border border-[#E9E4DC] rounded-lg overflow-hidden bg-white mt-4" id="query_results_area">
      <div class="px-4 py-2 bg-[#FAF8F5] border-b border-[#E9E4DC] flex items-center gap-2 text-xs">
        <template v-if="error">
          <AlertOctagon class="w-4 h-4 text-rose-600" />
          <span class="font-semibold text-rose-700">编译报错 (Syntax Parsing Exception)</span>
        </template>
        <template v-else>
          <CheckCircle class="w-4 h-4 text-emerald-600" />
          <span class="font-semibold text-emerald-700">执行成功 (Graph Query Completed)</span>
        </template>
      </div>

      <div class="p-4">
        <div v-if="error" class="p-3 bg-rose-50 border border-rose-100 text-rose-700 font-mono text-[11px] rounded whitespace-pre-wrap">
          {{ error }}
        </div>
        <div v-else-if="result && result.rows.length === 0" class="text-center py-6 text-xs text-gray-400">
          查询成功执行，但在知识图谱中没有找到满足上述约束条件的三元组记录。
        </div>
        <div v-else-if="result" class="overflow-x-auto">
          <table class="min-w-full divide-y divide-[#E9E4DC] text-left text-xs">
            <thead class="bg-[#FAF8F5]">
              <tr>
                <th v-for="(h, i) in result.headers" :key="i" class="px-4 py-2 font-semibold text-[#5C5246]">{{ h }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 text-gray-600">
              <tr v-for="(row, rIdx) in result.rows" :key="rIdx" class="hover:bg-gray-50 transition-colors">
                <td v-for="(h, cIdx) in result.headers" :key="cIdx" class="px-4 py-2 font-mono text-xs max-w-sm overflow-hidden text-ellipsis">
                  <span v-if="row[h] !== undefined">{{ row[h] }}</span>
                  <span v-else class="text-gray-300">-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
