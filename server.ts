import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

// Load our environment variables
dotenv.config();

import { Triplestore } from './src/lib/Triplestore';
import { GraphAnalysis } from './src/lib/GraphAnalysis';
import { EntitiesAlignment } from './src/lib/EntitiesAlignment';
import { AgentFlow } from './src/lib/AgentFlow';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 1. Initialize RDF Triplestore and Load Turtle Database
  const triplestore = new Triplestore();
  try {
    const ttlPath = path.join(process.cwd(), 'src/data/knowledge_graph.ttl');
    const ttlContent = fs.readFileSync(ttlPath, 'utf-8');
    triplestore.loadTurtle(ttlContent);
    console.log('RDF Triplestore successfully booted from disk.');
  } catch (err) {
    console.error('Failed to load RDF Turtle file:', err);
  }

  // 2. Initialize our AI Agent workflow
  const agentFlow = new AgentFlow(triplestore);

  // =====================================
  // API ROUTE DEFINITIONS
  // =====================================

  // API Health Indicator
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: '中国历代金石书画家知识图谱服务在线。' });
  });

  // POST /api/query: Core Agent Q&A loop
  app.post('/api/query', async (req, res) => {
    const { query, history } = req.body;
    if (!query) {
      return res.status(400).json({ error: '查询内容不能为空。' });
    }

    try {
      console.log(`[Agent API] Processing user query: "${query}"`);
      const response = await agentFlow.handleUserQuery(query, history || []);
      res.json(response);
    } catch (err: any) {
      console.error('[Agent API] Crash during run:', err);
      res.status(500).json({
        error: '服务解析异常',
        detail: err.message
      });
    }
  });

  // POST /api/sparql: Directly execute custom SPARQL select queries
  app.post('/api/sparql', (req, res) => {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'SPARQL查询语句不能为空。' });
    }

    try {
      console.log(`[SPARQL Engine] Executing raw query: \n${query}`);
      const result = triplestore.querySparql(query);
      res.json(result);
    } catch (err: any) {
      console.error('[SPARQL Engine] Parsing fail:', err);
      res.status(400).json({
        error: 'SPARQL执行失败',
        detail: err.message
      });
    }
  });

  // GET /api/graph: Dump D3-compatible nodes and links representation
  app.get('/api/graph', (req, res) => {
    try {
      const graphData = triplestore.extractGraphData();
      res.json(graphData);
    } catch (err: any) {
      res.status(500).json({ error: '图数据提取异常', detail: err.message });
    }
  });

  // GET /api/stats: Return advanced graph structures (centralities and communities)
  app.get('/api/stats', (req, res) => {
    try {
      const graphData = triplestore.extractGraphData();
      const centralities = GraphAnalysis.analyzeCentrality(graphData);
      const communities = GraphAnalysis.detectCommunities(graphData);
      res.json({ centralities, communities });
    } catch (err: any) {
      res.status(500).json({ error: '结构分析计算失败', detail: err.message });
    }
  });

  // POST /api/path: Find shortest lineage/mentor/friendship path between two nodes
  app.post('/api/path', (req, res) => {
    const { source, target } = req.body;
    if (!source || !target) {
      return res.status(400).json({ error: '起点和终点必须提供。' });
    }

    try {
      const graphData = triplestore.extractGraphData();
      const pathResult = GraphAnalysis.findShortestPath(graphData, source, target);
      res.json(pathResult);
    } catch (err: any) {
      res.status(500).json({ error: '路径规划失败', detail: err.message });
    }
  });

  // GET /api/entities: Get list of all personalities with their CTEXT/CBDB alignments
  app.get('/api/entities', (req, res) => {
    try {
      const graphData = triplestore.extractGraphData();
      const persons = graphData.nodes.filter(n => n.type === 'Person');

      const alignedList = persons.map(p => {
        // Find CTEXT and CBDB IDs from triplestore triples
        const triples = triplestore.getTriples();
        let ctextId = '';
        let cbdbId = '';

        triples.forEach(t => {
          if (t.subject === p.id) {
            if (t.predicate === 'ex:ctextId') ctextId = t.object.replace(/^"|"$/g, '');
            if (t.predicate === 'ex:cbdbId') cbdbId = t.object.replace(/^"|"$/g, '');
          }
        });

        const alignment = EntitiesAlignment.getAlignment(p.id, p.label, ctextId || undefined, cbdbId || undefined);
        return {
          id: p.id,
          label: p.label,
          dynasty: p.dynasty || '中华名儒',
          intro: p.intro || '',
          alignment
        };
      });

      res.json(alignedList);
    } catch (err: any) {
      res.status(500).json({ error: '对齐实体数据检索失败', detail: err.message });
    }
  });

  // Serve static assets in production, otherwise mount the Vite server middleware in dev
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, 'localhost', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer();
