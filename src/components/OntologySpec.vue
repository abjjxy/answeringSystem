<script setup lang="ts">
import { Database } from 'lucide-vue-next';

const classes = [
  { name: 'ex:Person', label: '人物 (Person)', comment: '《印人传》记录的篆刻家、印学家或金石名士。为图谱核心实体类别。' },
  { name: 'ex:School', label: '艺术门派流派 (School)', comment: '金石篆刻发展中自然沉淀形成的各具风骨特征的印社学派，如吴门派、徽雪渔派、西泠浙派、皖派等。' },
  { name: 'ex:ScriptStyle', label: '印风风格 (ScriptStyle)', comment: '人物所粿颐的艺术风格和篆刻印风，包括秦汉印风、拟古印、自然印、派系印转等。' },
  { name: 'ex:Location', label: '地理名籍 (Location)', comment: '艺术人物的籍贯原籍所在地，通常用于地缘流动及流派地理分布关联。' }
];

const objProps = [
  { prop: 'ex:father', label: '父亲', domain: 'ex:Person', range: 'ex:Person', comment: '家族直系血亲：指其生身之父，如文徵明是文彭之父。' },
  { prop: 'ex:child', label: '子女', domain: 'ex:Person', range: 'ex:Person', comment: '家族直系血亲：指其繁衍儿女，如文彭是文徵明长子。' },
  { prop: 'ex:studentOf', label: '师从', domain: 'ex:Person', range: 'ex:Person', comment: '学界授传：指其登堂入室拜于羽翼下的授教老师，如何震师从文彭。' },
  { prop: 'ex:teacherOf', label: '弟子/传人', domain: 'ex:Person', range: 'ex:Person', comment: '学界结业：指其门生授业人，如丁敬传之黄易。' },
  { prop: 'ex:interactedWith', label: '交游/挚友', domain: 'ex:Person', range: 'ex:Person', comment: '同侪交往：指跨越政道或地缘的艺术交往活动圈 and 密友契约。' },
  { prop: 'ex:founderOf', label: '开创', domain: 'ex:Person', range: 'ex:School', comment: '立宗立派：指某门艺术大成者首倡并吸引群贤归集的某一学派发端。' },
  { prop: 'ex:schoolMemberOf', label: '所属流派', domain: 'ex:Person', range: 'ex:School', comment: '宗派隶属：指后学弟子或拥戴者自投或归集入特定学派序列。' },
  { prop: 'ex:practicedStyle', domain: 'ex:Person', range: 'ex:ScriptStyle', label: '擅长风格', comment: '金石笔墨专长：指艺人毕生主张并精研的笔致金石风貌（如邓石如擅篆隶）。' },
  { prop: 'ex:nativePlace', domain: 'ex:Person', range: 'ex:Location', label: '籍贯', comment: '家宅原籍：指人物籍地地标。' }
];

const dataProps = [
  { prop: 'ex:zi', label: '字', range: 'xsd:string', comment: '文人幼年成年之后行礼而受的呼称，体现温文气质。' },
  { prop: 'ex:hao', label: '号', range: 'xsd:string', comment: '个人拟定、或同业敬赠的自号，常带有浓郁的闲居隐逸气息。' },
  { prop: 'ex:dynasty', label: '朝代', range: 'xsd:string', comment: '人物身处的历史朝代序列，常用于时代消歧及地政汇总。' },
  { prop: 'ex:birthYear', label: '生年', range: 'xsd:integer', comment: '西历精确生辰年份数值，充当图谱高精过滤和生平跨度比对。' },
  { prop: 'ex:deathYear', label: '卒年', range: 'xsd:integer', comment: '西历卒于哪一年的年份数值。' },
  { prop: 'ex:ctextId', label: 'ctext对齐ID', range: 'xsd:string', comment: '与古籍文献数字图书馆(ctext.org)中唯一实体节点的统一标识绑定。' },
  { prop: 'ex:cbdbId', label: 'CBDB对齐ID', range: 'xsd:string', comment: '与古代清史人物数据库中对应人物节点底帘编码关联。' },
  { prop: 'ex:introduction', label: '简介', range: 'xsd:string', comment: '详实的考据生平及艺术刀功成就小史。' }
];
</script>

<template>
  <div class="bg-[#FCFAF7] border border-[#E9E4DC] rounded-xl p-5 shadow-sm space-y-6" id="ontology_spec_panel">
    <!-- Intro -->
    <div>
      <h2 class="font-serif font-bold text-lg text-[#2D241E] flex items-center gap-2">
        <Database class="w-5 h-5 text-[#8C2D19]" />
        <span>篆刻艺术古籍语义本体论 (Ontology Schema Architecture)</span>
      </h2>
      <p class="text-xs text-gray-500 mt-1">
        本篇规定了语义网中《印人传》知识体系的底层 OWL / RDF Schema 本体描述。包含各类定义、对象关系属性 Domain (定义域/主语) 与 Range (值域/宾语)，以及数据属性类。
      </p>
    </div>

    <!-- RDFS Class Specification -->
    <div class="space-y-3">
      <h3 class="text-sm font-sans font-bold text-[#8C2D19] border-b pb-1">
        一、RDFS 抽象类定义 (Semantic Classes)
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="(cls, idx) in classes" :key="idx" class="p-3 bg-white border border-[#E9E4DC] rounded-lg space-y-1">
          <div class="flex items-center justify-between">
            <span class="font-mono text-xs font-bold text-[#8C2D19]">{{ cls.name }}</span>
            <span class="text-[10px] px-2 py-0.5 bg-stone-100 text-gray-600 rounded">Class</span>
          </div>
          <div class="text-xs font-serif font-bold text-[#2D241E]">{{ cls.label }}</div>
          <div class="text-[11px] text-gray-500 leading-relaxed font-sans mt-0.5">{{ cls.comment }}</div>
        </div>
      </div>
    </div>

    <!-- RDFS Object Property Specification -->
    <div class="space-y-3">
      <h3 class="text-sm font-sans font-bold text-[#8C2D19] border-b pb-1">
        二、语义联结关系：对象属性 (Object Properties)
      </h3>
      <div class="overflow-x-auto border border-[#E9E4DC] rounded-lg">
        <table class="min-w-full divide-y divide-gray-150 text-xs bg-white">
          <thead class="bg-[#FAF8F5]">
            <tr class="text-[#5C5246] text-left">
              <th class="px-3 py-2 font-semibold">属性 (URI ID)</th>
              <th class="px-3 py-2 font-semibold">关系名称</th>
              <th class="px-3 py-2 font-semibold">定义域 (Domain)</th>
              <th class="px-3 py-2 font-semibold">值域 (Range)</th>
              <th class="px-3 py-2 font-semibold">业务逻辑与学术注释</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 text-gray-600">
            <tr v-for="(prop, idx) in objProps" :key="idx" class="hover:bg-gray-50 transition-colors">
              <td class="px-3 py-2 font-mono text-[10.5px] text-[#8C2D19] font-semibold">{{ prop.prop }}</td>
              <td class="px-3 py-2 font-serif font-bold text-[#2D241E]">{{ prop.label }}</td>
              <td class="px-3 py-2 font-mono text-[10px]">{{ prop.domain }}</td>
              <td class="px-3 py-2 font-mono text-[10px]">{{ prop.range }}</td>
              <td class="px-3 py-2 text-stone-500 scale-95 origin-left">{{ prop.comment }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- RDFS Datatype Property Specification -->
    <div class="space-y-3">
      <h3 class="text-sm font-sans font-bold text-[#8C2D19] border-b pb-1">
        三、描述性数据属性 (Datatype Properties)
      </h3>
      <div class="overflow-x-auto border border-[#E9E4DC] rounded-lg">
        <table class="min-w-full divide-y divide-gray-150 text-xs bg-white">
          <thead class="bg-[#FAF8F5]">
            <tr class="text-[#5C5246] text-left">
              <th class="px-3 py-2 font-semibold">数据项 (URI ID)</th>
              <th class="px-3 py-2 font-semibold">描述名称</th>
              <th class="px-3 py-2 font-semibold">数据类型 (Range)</th>
              <th class="px-3 py-2 font-semibold">规范形态说明</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 text-gray-600">
            <tr v-for="(prop, idx) in dataProps" :key="idx" class="hover:bg-gray-50 transition-colors">
              <td class="px-3 py-2 font-mono text-[10.5px] text-amber-800 font-semibold">{{ prop.prop }}</td>
              <td class="px-3 py-2 font-serif font-bold text-[#2D241E]">{{ prop.label }}</td>
              <td class="px-3 py-2 font-mono text-[10px] text-gray-500">{{ prop.range }}</td>
              <td class="px-3 py-2 text-stone-500 scale-95 origin-left">{{ prop.comment }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
