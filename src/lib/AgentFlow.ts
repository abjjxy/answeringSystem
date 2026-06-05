import { GoogleGenAI } from '@google/genai';
import { Triplestore } from './Triplestore';
import { GraphAnalysis } from './GraphAnalysis';
import { EntitiesAlignment } from './EntitiesAlignment';
import { AgentStep, ChatMessage } from '../types';

export class AgentFlow {
  private ai: GoogleGenAI;
  private triplestore: Triplestore;

  constructor(triplestore: Triplestore) {
    this.ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    this.triplestore = triplestore;
  }

  /**
   * Main agent loop implementing modular step actions (Question Parsing, Routing, Tool Matching, SPARQL Solving).
   */
  public async handleUserQuery(userQuery: string, chatHistory: any[] = []): Promise<ChatMessage> {
    const steps: AgentStep[] = [];
    const createStep = (name: string, status: 'start' | 'success' | 'failure', detail: string) => {
      steps.push({
        name,
        status,
        detail,
        timestamp: new Date().toISOString()
      });
    };

    try {
      // 1. QUESTION PARSING & ROUTING NODE
      createStep('解析问句 & 任务分流', 'start', `对查询「${userQuery}」进行语义意图分析，决定底层路线...`);
      
      const routerPrompt = `
你是一个专精于《印人传》篆刻艺术与金石学知识图谱的智能分析路由器。
当前用户的查询语句为: "${userQuery}"

请分析该查询最适合以下哪一种处理逻辑。只能输出一个合法的 JSON，不要包裹任何 markdown：
{
  "route": "tool_call" | "sparql_generation" | "direct_llm",
  "toolName": "QueryPersonDetails" | "QueryRelations" | "QueryAestheticsAndSchool" | "GetCentralityAnalysis" | "FindPathBetween" | null,
  "toolArgs": { ... } | null,
  "justification": "对选择原因的简短中文陈述"
}

分流标准：
1. "tool_call"：如果查询的是单个具体人物的详细生平、或者问某个人的字号(e.g., "文彭的字号是什么")、他的父亲或子女师承(e.g., "何震的老师是谁")、他属于哪个流派或擅长的印风，或者直接需要计算网络度指标、分析人物师承路径(e.g., "查一下何震和邓石如之间的师承路径")。
   - "QueryPersonDetails" : Args: { "name": "文彭" }
   - "QueryRelations" : Args: { "name": "文彭" }
   - "QueryAestheticsAndSchool" : Args: { "name": "文彭" }
   - "GetCentralityAnalysis" : Args: {}
   - "FindPathBetween" : Args: { "personA": "文徵明", "personB": "吴昌硕" }
2. "sparql_generation"：如果用户的提问涉及多重条件关联、复杂的汇总统计、过滤比较(e.g., "找出所有生于1500年之后的清代篆刻家"、"哪些人开创了印派，他们分别属于什么朝代？"、"查一下文徵明弟子中擅长秦汉印风的人")。
3. "direct_llm"：用户聊日常、问关于篆刻艺术的泛化美学理论或超出本图谱人物生平的问题。
`;

      const routeResult = await this.ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: routerPrompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const routeData = JSON.parse(routeResult.text || '{}');
      createStep('解析问句 & 任务分流', 'success', `路由判定路线：[${routeData.route}]。原因：${routeData.justification}`);

      // 2a. TOOL EXECUTION PATH
      if (routeData.route === 'tool_call' && routeData.toolName) {
        createStep('结构化工具调用', 'start', `开始执行工具 ${routeData.toolName}，参数为 ${JSON.stringify(routeData.toolArgs)}`);
        
        let toolOutput = '';
        let visualData: any = null;

        const args = routeData.toolArgs || {};
        switch (routeData.toolName) {
          case 'QueryPersonDetails':
            toolOutput = JSON.stringify(this.toolQueryPersonDetails(args.name));
            break;
          case 'QueryRelations':
            toolOutput = JSON.stringify(this.toolQueryRelations(args.name));
            break;
          case 'QueryAestheticsAndSchool':
            toolOutput = JSON.stringify(this.toolQueryAestheticsAndSchool(args.name));
            break;
          case 'GetCentralityAnalysis':
            const centrality = GraphAnalysis.analyzeCentrality(this.triplestore.extractGraphData());
            toolOutput = JSON.stringify(centrality);
            visualData = { type: 'sparql_table', payload: { headers: ['人物', '类型', '度中心性', '介数中心性'], rows: centrality.slice(0, 10).map(c => [c.label, c.type, c.degreeCentrality, c.betweennessCentrality]) } };
            break;
          case 'FindPathBetween':
            const pathRes = GraphAnalysis.findShortestPath(this.triplestore.extractGraphData(), this.getURIFromName(args.personA), this.getURIFromName(args.personB));
            toolOutput = JSON.stringify(pathRes);
            visualData = { type: 'paths', payload: pathRes };
            break;
          default:
            toolOutput = '未找到匹配的预置工具';
        }

        createStep('结构化工具调用', 'success', `工具 ${routeData.toolName} 回传数据就绪。`);

        // 3. GENERATE ANSWER FROM TOOL RESULTS
        createStep('大模型精整回复', 'start', '将工具返回的严谨结构化数据输入Gemini，编织成流畅典雅的中文陈述。');
        
        const finalAnsPrompt = `
您是一个古典文化修养极高的中国篆刻艺术与金石学专家。
用户问句: "${userQuery}"
我们为您调用了底层的知识图谱专属APIs，并查询到以下结构化元数据：
${toolOutput}

请基于上述结构化查询结果，给用户写一个优美、客观、详实的回答。
请注意：
1. 恪守事实，优先使用查询回传的数据回答。
2. 保持语言风格高雅，传递篆刻艺术之美。
3. 请用 Markdown 输出。
4. 在回答最后附加列出参考的数据源标识（如果有的话）。
`;
        const ansResponse = await this.ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: finalAnsPrompt
        });

        createStep('大模型精整回复', 'success', '答复提炼完成。');

        return {
          id: 'msg_' + Math.random().toString(36).substring(7),
          role: 'assistant',
          content: ansResponse.text || '未能生成最终回答。',
          steps,
          visualData,
          timestamp: new Date().toISOString()
        };
      }

      // 2b. SPARQL GENERATION NODE
      if (routeData.route === 'sparql_generation') {
        createStep('SPARQL语句主动生成', 'start', '启用Few-shot少样本模式，提示Gemini根据图谱本体结构自动构建SPARQL三元组查询...');

        const sparqlPrompt = `
你是一个RDF SPARQL大管家。你的职责是根据用户的中国历史提问生成标准的、准确的、可立刻执行的SPARQL SELECT查询。
我们的图谱本体前缀和定义如下：
@prefix ex: <http://example.org/calligraphy#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

本体属性参考：
- ex:zi (字) - e.g., "寿承_xsd:string"
- ex:hao (号) - e.g., "三桥_xsd:string"
- ex:dynasty (朝代) - values: "东晋", "唐", "元", "明", "清", "晚清 / 民国"
- ex:birthYear (生年_xsd:integer) - e.g. 1498
- ex:deathYear (卒年_xsd:integer) - e.g. 1573
- ex:father (父亲), ex:child (子女), ex:studentOf (师从), ex:teacherOf (授学), ex:interactedWith (交游)
- ex:founderOf (开创流派) - values: ex:WumenSchool, ex:XilingSchool, ex:WanpaiSchool, ex:XueyuSchool, ex:SishuiSchool, ex:LoudongSchool
- ex:schoolMemberOf (所属流派)
- ex:practicedStyle (擅长艺术风格) - values: ex:QinHanSeals, ex:SealScript, ex:ClericalScript, ex:RunningScript, ex:RegularScript, ex:WeiSteleStyle, ex:StoneDrumScript
- ex:nativePlace (籍贯)
- rdfs:label (名字标签字符串)

【优秀Few-shot示例】
用户问: "哪些人在清代开创了流派，叫什么名字？"
输出:
SELECT ?name ?schoolLabel WHERE {
  ?person rdf:type ex:Person .
  ?person ex:dynasty "清" .
  ?person ex:founderOf ?school .
  ?person rdfs:label ?name .
  ?school rdfs:label ?schoolLabel .
}

用户问: "邓石如有什么擅长风格，他是哪一年出生的？"
输出:
SELECT ?styleLabel ?birth WHERE {
  ex:DengShiru ex:practicedStyle ?style .
  ex:DengShiru ex:birthYear ?birth .
  ?style rdfs:label ?styleLabel .
}

用户问: "哪些人是丁敬的徒弟，他们擅长什么？"
输出:
SELECT ?discipleLabel ?styleLabel WHERE {
  ex:DingJing ex:teacherOf ?disciple .
  ?disciple rdfs:label ?discipleLabel .
  ?disciple ex:practicedStyle ?style .
  ?style rdfs:label ?styleLabel .
}

现在，请为以下用户问句编写SPARQL。
只输出SPARQL SELECT代码块，不要写任何前言说明，不要用 markdown 包裹：
"${userQuery}"
`;

        const sparqlGenResult = await this.ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: sparqlPrompt
        });

        let sparqlQuery = sparqlGenResult.text || '';
        // Strip wrap if Gemini insists markdown block
        sparqlQuery = sparqlQuery.replace(/```sparql|```/gi, '').trim();

        createStep('SPARQL语句主动生成', 'success', `成功自主生成SPARQL语句：\n${sparqlQuery}`);

        // EXECUTE SPARQL IN STORE
        createStep('SPARQL语句直接执行', 'start', '将生成的SPARQL载入本地RDF三元组引擎运行并在图解中寻找约束解...');
        
        let queryResult;
        try {
          queryResult = this.triplestore.querySparql(sparqlQuery);
          createStep('SPARQL语句直接执行', 'success', `执行成功：获取到 ${queryResult.rows.length} 行匹配绑定数据。`);
        } catch (queryErr: any) {
          createStep('SPARQL语句直接执行', 'failure', `引擎执行报错：${queryErr.message}。尝试备用直接生成方案。`);
          queryResult = null;
        }

        // 3. INTERPRET RESULT
        createStep('解算结果归纳与美化', 'start', '将SPARQL关系代数绑定结果传给大模型，渲染成专业严谨的历史志论格式。');
        
        let ansPrompt = '';
        if (queryResult && queryResult.rows.length > 0) {
          ansPrompt = `
您是一位古风篆刻与书学泰斗。
用户向知识图谱提问：「${userQuery}」
我们在本地RDF Triplestore上成功为您运算了SPARQL并获得以下准确的数据：
字段：${queryResult.headers.join(', ')}
绑定行：
${JSON.stringify(queryResult.rows, null, 2)}

请结合用户提问与SPARQL绑定的真实客观信息，生成一段详尽有据、极具书风雅言的Markdown分析回答。
`;
        } else {
          ansPrompt = `
用户想查询关于中国篆刻艺术家提问: "${userQuery}"
我们在RDF图谱中进行SPARQL多步关联查找未能找到直接匹配（可能是图谱范围限制）。
请您发挥大语言模型原生的中国历史、篆刻艺术、金石学知识储备，直接为用户附进行全面、专业且典雅的科普和分析。
提示用户：本回答基于通用古典文学大模型和金石学简散知识直接生成。
`;
        }

        const ansResponse = await this.ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: ansPrompt
        });

        createStep('解算结果归纳与美化', 'success', '全链路图谱查询解答输出。');

        return {
          id: 'msg_' + Math.random().toString(36).substring(7),
          role: 'assistant',
          content: ansResponse.text || '抱歉，未能正常生成图谱答复。',
          steps,
          visualData: queryResult ? { type: 'sparql_table', payload: queryResult } : undefined,
          timestamp: new Date().toISOString()
        };
      }

      // 2c. DIRECT LLM PATH (GENERAL HISTORY/CHITCHAT)
      createStep('大模型深度通识应答', 'start', '非图谱关系型通识性知识问答，加载大模型中华国粹篆刻艺术知识直接生成...');
      const directResponse = await this.ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `
请作为篆刻艺术与金石学学识渊博的大师，优雅地回答下述用户的提问：
"${userQuery}"
`
      });
      createStep('大模型深度通识应答', 'success', '通识科普生成就绪。');

      return {
        id: 'msg_' + Math.random().toString(36).substring(7),
        role: 'assistant',
        content: directResponse.text || '已了解。',
        steps,
        timestamp: new Date().toISOString()
      };

    } catch (err: any) {
      console.error('Agent Workflow crash:', err);
      return {
        id: 'msg_err',
        role: 'assistant',
        content: `抱歉，在处理您的查询时，智能工作流发生阻塞。报错原因：${err.name} - ${err.message}`,
        steps,
        timestamp: new Date().toISOString()
      };
    }
  }

  // PRE-BAKED TOOL IMPLEMENTATIONS FOR DETAILED QUERIES
  private toolQueryPersonDetails(name: string): any {
    const uri = this.getURIFromName(name);
    const triples = this.triplestore.getTriples();
    
    const details: any = { name };
    triples.forEach(t => {
      if (t.subject === uri) {
        const cleanObj = t.object.replace(/^"|"$/g, '');
        if (t.predicate === 'ex:zi') details.zi = cleanObj;
        else if (t.predicate === 'ex:hao') details.hao = cleanObj;
        else if (t.predicate === 'ex:dynasty') details.dynasty = cleanObj;
        else if (t.predicate === 'ex:birthYear') details.birthYear = parseInt(cleanObj);
        else if (t.predicate === 'ex:deathYear') details.deathYear = parseInt(cleanObj);
        else if (t.predicate === 'ex:introduction') details.introduction = cleanObj;
        else if (t.predicate === 'ex:ctextId') details.ctextId = cleanObj;
        else if (t.predicate === 'ex:cbdbId') details.cbdbId = cleanObj;
      }
    });

    if (details.ctextId || details.cbdbId) {
      details.alignment = EntitiesAlignment.getAlignment(uri, name, details.ctextId, details.cbdbId);
    }
    return details;
  }

  private toolQueryRelations(name: string): any {
    const uri = this.getURIFromName(name);
    const triples = this.triplestore.getTriples();
    
    const relations: any = {
      name,
      father: null,
      children: [],
      mentors: [],
      disciples: [],
      friends: []
    };

    // Forward and reverse lookups
    triples.forEach(t => {
      if (t.subject === uri) {
        if (t.predicate === 'ex:father') relations.father = this.getNameFromURI(t.object);
        if (t.predicate === 'ex:child') relations.children.push(this.getNameFromURI(t.object));
        if (t.predicate === 'ex:studentOf') relations.mentors.push(this.getNameFromURI(t.object));
        if (t.predicate === 'ex:teacherOf') relations.disciples.push(this.getNameFromURI(t.object));
        if (t.predicate === 'ex:interactedWith') relations.friends.push(this.getNameFromURI(t.object));
      }
      
      // Reverse link
      if (t.object === uri) {
        if (t.predicate === 'ex:father') relations.children.push(this.getNameFromURI(t.subject));
        if (t.predicate === 'ex:studentOf') relations.disciples.push(this.getNameFromURI(t.subject));
        if (t.predicate === 'ex:teacherOf') relations.mentors.push(this.getNameFromURI(t.subject));
        if (t.predicate === 'ex:interactedWith' && !relations.friends.includes(this.getNameFromURI(t.subject))) {
          relations.friends.push(this.getNameFromURI(t.subject));
        }
      }
    });

    return relations;
  }

  private toolQueryAestheticsAndSchool(name: string): any {
    const uri = this.getURIFromName(name);
    const triples = this.triplestore.getTriples();
    
    const results: any = {
      name,
      foundedSchools: [],
      schoolsJoined: [],
      stylesPinnacled: []
    };

    triples.forEach(t => {
      if (t.subject === uri) {
        if (t.predicate === 'ex:founderOf') results.foundedSchools.push(this.getNameFromURI(t.object));
        if (t.predicate === 'ex:schoolMemberOf') results.schoolsJoined.push(this.getNameFromURI(t.object));
        if (t.predicate === 'ex:practicedStyle') results.stylesPinnacled.push(this.getNameFromURI(t.object));
      }
    });

    return results;
  }

  // Normalized translation between simple input name and graph ex: URI
  private getURIFromName(name: string): string {
    const lookups: Record<string, string> = {
      '王羲之': 'ex:WangXizhi',
      '颜真卿': 'ex:YanZhenqing',
      '赵孟頫': 'ex:ZhaoMengfu',
      '文徵明': 'ex:WenZhengming',
      '文彭': 'ex:WenPeng',
      '何震': 'ex:HeZhen',
      '苏宣': 'ex:SuXuan',
      '朱简': 'ex:ZhuJian',
      '程邃': 'ex:ChengSui',
      '汪关': 'ex:WangGuan',
      '丁敬': 'ex:DingJing',
      '黄易': 'ex:HuangYi',
      '邓石如': 'ex:DengShiru',
      '吴熙载': 'ex:WuXizai',
      '赵之谦': 'ex:ZhaoZhiqian',
      '吴昌硕': 'ex:WuChangshuo',
    };
    return lookups[name] || `ex:${name}`;
  }

  private getNameFromURI(uri: string): string {
    if (uri.startsWith('ex:')) {
      const labelShort = uri.substring(3);
      const decodes: Record<string, string> = {
        'WangXizhi': '王羲之',
        'YanZhenqing': '颜真卿',
        'ZhaoMengfu': '赵孟頫',
        'WenZhengming': '文徵明',
        'WenPeng': '文彭',
        'HeZhen': '何震',
        'SuXuan': '苏宣',
        'ZhuJian': '朱简',
        'ChengSui': '程邃',
        'WangGuan': '汪关',
        'DingGing': '丁敬',
        'DingJing': '丁敬',
        'HuangYi': '黄易',
        'DengShiru': '邓石如',
        'WuXizai': '吴熙载',
        'ZhaoZhiqian': '赵之谦',
        'WuChangshuo': '吴昌硕',
        'WumenSchool': '吴门印派',
        'XilingSchool': '西泠引画 (浙派)',
        'WanpaiSchool': '皖派 (邓派)',
        'XueyuSchool': '雪渔派 (徽派)',
        'SishuiSchool': '泗水印派',
        'LoudongSchool': '娄东印派',
        'QinHanSeals': '秦汉印风',
        'SealScript': '篆书',
        'ClericalScript': '隶书',
        'RunningScript': '行书',
        'CursiveScript': '草书',
        'RegularScript': '楷书',
        'WeiSteleStyle': '魏碑体',
        'StoneDrumScript': '石鼓文'
      };
      return decodes[labelShort] || labelShort;
    }
    return uri;
  }
}
