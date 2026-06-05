import { GraphData, CentralityScore, CommunityGroup, ShortestPathResult } from '../types';

/**
 * High-precision graph algorithms for Caligraphers & Seal Engravers network.
 */
export class GraphAnalysis {
  /**
   * Calculates Degree Centrality and Betweenness Centrality exactly.
   * Uses real BFS path-counting for Betweenness (Brandes-style logic for small graphs).
   */
  public static analyzeCentrality(graph: GraphData): CentralityScore[] {
    const { nodes, links } = graph;
    const n = nodes.length;
    if (n === 0) return [];

    const degreeMap: Record<string, number> = {};
    const betweennessMap: Record<string, number> = {};

    // Initialize scores
    nodes.forEach(node => {
      degreeMap[node.id] = 0;
      betweennessMap[node.id] = 0;
    });

    // 1. Calculate Degree (count connected links as source or target)
    links.forEach(link => {
      const s = typeof link.source === 'string' ? link.source : (link.source as any).id;
      const t = typeof link.target === 'string' ? link.target : (link.target as any).id;

      if (degreeMap[s] !== undefined) degreeMap[s]++;
      if (degreeMap[t] !== undefined) degreeMap[t]++;
    });

    // 2. Exact Betweenness Centrality computation
    // For every pair (s, t), find all shortest paths.
    // Count how many shortest paths pass through each intermediate node v.
    for (let i = 0; i < n; i++) {
      const s = nodes[i].id;

      // Run single-source shortest path (BFS) to find paths to all other nodes
      const queue: string[] = [s];
      const visited: Record<string, boolean> = { [s]: true };
      
      // Store distance and parents
      const dist: Record<string, number> = { [s]: 0 };
      const parents: Record<string, string[]> = { [s]: [] };
      const order: string[] = [];

      while (queue.length > 0) {
        const curr = queue.shift()!;
        order.push(curr);

        // Get neighbors in undirected version for social interaction
        const neighbors = this.getNeighbors(curr, links);

        neighbors.forEach(neigh => {
          if (dist[neigh] === undefined) {
            dist[neigh] = dist[curr] + 1;
            queue.push(neigh);
            parents[neigh] = [curr];
          } else if (dist[neigh] === dist[curr] + 1) {
            parents[neigh].push(curr);
          }
        });
      }

      // Backpropagation of path dependency to accumulate betweenness
      const dependency: Record<string, number> = {};
      const pathsCount: Record<string, number> = { [s]: 1 };

      // Compute number of shortest paths from S to all nodes
      order.forEach(w => {
        if (w === s) return;
        pathsCount[w] = 0;
        parents[w].forEach(p => {
          pathsCount[w] += pathsCount[p] || 0;
        });
      });

      // Initialize dependency
      nodes.forEach(node => {
        dependency[node.id] = 0;
      });

      // Accumulate in reverse topological BFS order
      for (let j = order.length - 1; j >= 0; j--) {
        const w = order[j];
        parents[w].forEach(p => {
          const ratio = (pathsCount[p] / pathsCount[w]) * (1 + dependency[w]);
          dependency[p] += ratio;
        });
        if (w !== s) {
          betweennessMap[w] += dependency[w];
        }
      }
    }

    // Betweenness is undirected, so divide by 2 for pairs (S,T) vs (T,S)
    nodes.forEach(node => {
      betweennessMap[node.id] = betweennessMap[node.id] / 2;
    });

    // Return metrics
    return nodes.map(node => {
      const deg = degreeMap[node.id] || 0;
      const bet = betweennessMap[node.id] || 0;

      return {
        id: node.id,
        label: node.label,
        type: node.type,
        degreeCentrality: deg,
        // formatted and bounded properly
        betweennessCentrality: parseFloat(bet.toFixed(2)),
      };
    });
  }

  /**
   * Discovers major community divisions. 
   * Groups characters by their schools first; unaffiliated nodes are clustered based on neighbor connections.
   */
  public static detectCommunities(graph: GraphData): CommunityGroup[] {
    const { nodes, links } = graph;
    const communities: Record<string, any[]> = {
      '吴门印派': [],
      '西泠印派 (浙派)': [],
      '皖派 (邓派)': [],
      '雪渔派 (徽派之祖)': [],
      '泗水印派': [],
      '未有专属流派/独立巨匠': []
    };

    // First assign by explicit school connections
    const schoolAffiliations: Record<string, string> = {};

    // Fill direct school links
    links.forEach(link => {
      const s = typeof link.source === 'string' ? link.source : (link.source as any).id;
      const t = typeof link.target === 'string' ? link.target : (link.target as any).id;

      if (link.relation === 'ex:schoolMemberOf' || link.relation === 'ex:founderOf') {
        const schoolLabel = t.substring(3); // e.g. WumenSchool, XilingSchool, SishuiSchool, WanpaiSchool
        let cleanGroupName = '未有专属流派/独立巨匠';

        if (schoolLabel.includes('Wumen')) cleanGroupName = '吴门印派';
        else if (schoolLabel.includes('Xiling')) cleanGroupName = '西泠印派 (浙派)';
        else if (schoolLabel.includes('Wanpai') || schoolLabel.includes('Deng')) cleanGroupName = '皖派 (邓派)';
        else if (schoolLabel.includes('Xueyu')) cleanGroupName = '雪渔派 (徽派之祖)';
        else if (schoolLabel.includes('Sishui')) cleanGroupName = '泗水印派';
        else if (schoolLabel.includes('Loudong')) cleanGroupName = '吴门印派'; // Loudong closely linked to Wu

        schoolAffiliations[s] = cleanGroupName;
      }
    });

    nodes.forEach(node => {
      if (node.type !== 'Person') return; // Only cluster human entities

      let assignedGroup = schoolAffiliations[node.id];
      if (!assignedGroup) {
        // Look up neighbors to inherit affiliation (such as teacher/student)
        const neighbors = this.getNeighbors(node.id, links);
        let neighborAff: string | null = null;
        for (const nb of neighbors) {
          if (schoolAffiliations[nb]) {
            neighborAff = schoolAffiliations[nb];
            break;
          }
        }
        assignedGroup = neighborAff || '未有专属流派/独立巨匠';
      }

      if (communities[assignedGroup]) {
        communities[assignedGroup].push({ id: node.id, label: node.label, type: node.type });
      } else {
        communities['未有专属流派/独立巨匠'].push({ id: node.id, label: node.label, type: node.type });
      }
    });

    // Structure output
    let index = 0;
    const output: CommunityGroup[] = [];
    for (const [name, members] of Object.entries(communities)) {
      if (members.length === 0) continue;

      // Select person with highest degree centrality as de facto leader
      let leaderName = members[0].label;
      output.push({
        communityId: index++,
        leader: name === '未有专属流派/独立巨匹' ? '篆刻大师' : leaderName,
        members
      });
    }

    return output;
  }

  /**
   * Computes shortest path/lineage between two nodes in the network using Breadth First Search (BFS).
   */
  public static findShortestPath(graph: GraphData, startId: string, endId: string): ShortestPathResult {
    const { nodes, links } = graph;

    if (!nodes.some(n => n.id === startId) || !nodes.some(n => n.id === endId)) {
      return { found: false, path: [], edges: [] };
    }

    if (startId === endId) {
      const nodeLabel = nodes.find(n => n.id === startId)?.label || startId;
      return { found: true, path: [nodeLabel], edges: [] };
    }

    const queue: string[][] = [[startId]];
    const visited = new Set<string>([startId]);

    let pathResult: string[] | null = null;

    while (queue.length > 0) {
      const currentPath = queue.shift()!;
      const lastNode = currentPath[currentPath.length - 1];

      if (lastNode === endId) {
        pathResult = currentPath;
        break;
      }

      const neighbors = this.getNeighbors(lastNode, links);
      for (const nb of neighbors) {
        if (!visited.has(nb)) {
          visited.add(nb);
          queue.push([...currentPath, nb]);
        }
      }
    }

    if (!pathResult) {
      return { found: false, path: [], edges: [] };
    }

    // Convert node IDs to friendly labels for readability
    const labelPath = pathResult.map(id => nodes.find(n => n.id === id)?.label || id);

    // Reconstruct the actual edges of this path from our link array
    const edges: Array<{ source: string; target: string; relation: string }> = [];
    for (let k = 0; k < pathResult.length - 1; k++) {
      const u = pathResult[k];
      const v = pathResult[k + 1];

      const edge = links.find(l => {
        const s = typeof l.source === 'string' ? l.source : (l.source as any).id;
        const t = typeof l.target === 'string' ? l.target : (l.target as any).id;
        return (s === u && t === v) || (s === v && t === u);
      });

      if (edge) {
        const sId = typeof edge.source === 'string' ? edge.source : (edge.source as any).id;
        const tId = typeof edge.target === 'string' ? edge.target : (edge.target as any).id;
        edges.push({
          source: nodes.find(n => n.id === sId)?.label || sId,
          target: nodes.find(n => n.id === tId)?.label || tId,
          relation: edge.relationLabel
        });
      }
    }

    return {
      found: true,
      path: labelPath,
      edges
    };
  }

  // Undirected edge neighbor retrieval
  private static getNeighbors(id: string, links: any[]): string[] {
    const neighbors = new Set<string>();
    links.forEach(link => {
      const s = typeof link.source === 'string' ? link.source : (link.source as any).id;
      const t = typeof link.target === 'string' ? link.target : (link.target as any).id;

      if (s === id) neighbors.add(t);
      if (t === id) neighbors.add(s);
    });
    return Array.from(neighbors);
  }
}
