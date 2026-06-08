export interface Triple {
  subject: string;
  predicate: string;
  object: string;
}

export interface NamespacePrefixes {
  [prefix: string]: string;
}

export interface SPARQLResult {
  headers: string[];
  rows: Array<Record<string, string>>;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'Person' | 'School' | 'ScriptStyle' | 'Location';
  dynasty?: string;
  intro?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  relation: string;
  relationLabel: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface CentralityScore {
  id: string;
  label: string;
  type: string;
  degreeCentrality: number;
  betweennessCentrality: number;
}

export interface CommunityGroup {
  communityId: number;
  leader: string;
  members: Array<{ id: string; label: string; type: string }>;
}

export interface ShortestPathResult {
  found: boolean;
  path: string[]; // List of Node IDs (or labels)
  edges: Array<{ source: string; target: string; relation: string }>;
}

export interface GraphAnalysisOutput {
  centralities: CentralityScore[];
  communities: CommunityGroup[];
  schools?: SchoolAnalysisResult;
}

export interface SchoolFigure {
  id: string;
  label: string;
  role: '开创者' | '核心人物' | '成员';
  dynasty?: string;
}

export interface SchoolAnalysis {
  schoolId: string;
  schoolLabel: string;
  founder?: SchoolFigure;
  coreFigures: SchoolFigure[];
  memberCount: number;
  members: SchoolFigure[];
  period: string;
}

export interface SchoolBridge {
  personA: string;
  personB: string;
  schoolA: string;
  schoolB: string;
  relation: string;
}

export interface SchoolEvolution {
  era: string;
  schools: string[];
  note: string;
}

export interface SchoolAnalysisResult {
  schools: SchoolAnalysis[];
  bridges: SchoolBridge[];
  evolution: SchoolEvolution[];
}

// ctext and CBDB alignment types
export interface DBAlignmentInfo {
  personId: string;
  label: string;
  ctextId?: string;
  cbdbId?: string;
  dbType: 'ctext' | 'cbdb' | 'both' | 'none';
  status: 'aligned' | 'fuzzy' | 'not_found';
  supplementalData?: {
    officePlayed?: string[]; // 官职/历任
    altNames?: string[]; // 别名
    birthPlaceInfo?: string; // 户籍详细
    parentInfo?: string; // 父母记录
    sourceRecordUrl?: string; // 古籍文献链接
  };
}

// Q&A agent types
export interface AgentStep {
  name: string; // e.g., "解析问句", "结构化工具调用", "SPARQL生成", "大模型精整回复"
  status: 'start' | 'success' | 'failure';
  detail: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  steps?: AgentStep[];
  citations?: string[];
  visualData?: {
    type: 'sparql_table' | 'paths';
    payload: any;
  };
  timestamp: string;
}
