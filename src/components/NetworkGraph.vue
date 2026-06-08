<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import * as d3 from 'd3';
import type { GraphData, GraphNode } from '../types';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-vue-next';

interface Props {
  data: GraphData;
  selectedNode: GraphNode | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'selectNode', node: GraphNode): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);

type ViewMode = 'person' | 'school';

const viewMode = ref<ViewMode>('person');

const showRelations = ref({
  family: true,
  mentorship: true,
  friendship: true,
  school: false,
  style: false,
  native: false,
});

const applyViewMode = (mode: ViewMode) => {
  viewMode.value = mode;
  if (mode === 'person') {
    showRelations.value = { family: true, mentorship: true, friendship: true, school: false, style: false, native: false };
  } else {
    showRelations.value = { family: false, mentorship: true, friendship: false, school: true, style: false, native: false };
  }
};

const hoveredNode = ref<GraphNode | null>(null);
const highlightNeighborhood = ref<Set<string>>(new Set());
const dimensions = ref({ width: 600, height: 500 });
const zoomBehaviorRef = ref<any>(null);
const currentTransform = ref<any>(d3.zoomIdentity); // 保存缩放状态

// Handle graph filtering
const filteredLinks = computed(() => {
  return props.data.links.filter(link => {
    const rel = link.relation;
    if (rel === 'ex:father' || rel === 'ex:child') return showRelations.value.family;
    if (rel === 'ex:studentOf' || rel === 'ex:teacherOf') return showRelations.value.mentorship;
    if (rel === 'ex:interactedWith') return showRelations.value.friendship;
    if (rel === 'ex:schoolMemberOf' || rel === 'ex:founderOf') return showRelations.value.school;
    if (rel === 'ex:practicedStyle') return showRelations.value.style;
    if (rel === 'ex:nativePlace') return showRelations.value.native;
    return true;
  });
});

const filteredNodes = computed(() => {
  const activeNodeIds = new Set<string>();
  filteredLinks.value.forEach(l => {
    activeNodeIds.add(typeof l.source === 'string' ? l.source : (l.source as any).id);
    activeNodeIds.add(typeof l.target === 'string' ? l.target : (l.target as any).id);
  });

  return props.data.nodes.filter(n => {
    if (viewMode.value === 'person') return n.type === 'Person' && activeNodeIds.has(n.id);
    if (n.type === 'Person') return activeNodeIds.has(n.id);
    if (n.type === 'School') return activeNodeIds.has(n.id);
    return false;
  });
});

// Resize observer
let observer: ResizeObserver | null = null;
onMounted(() => {
  if (containerRef.value) {
    observer = new ResizeObserver(entries => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      dimensions.value = {
        width: Math.max(width, 300),
        height: Math.max(height, 450),
      };
    });
    observer.observe(containerRef.value);
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
});

// Update Highlight neighborhood around selectedNode
watch(() => props.selectedNode, (newSelectedNode) => {
  if (!newSelectedNode) {
    highlightNeighborhood.value = new Set();
    return;
  }
  const neighbors = new Set<string>([newSelectedNode.id]);
  props.data.links.forEach(l => {
    const s = typeof l.source === 'string' ? l.source : (l.source as any).id;
    const t = typeof l.target === 'string' ? l.target : (l.target as any).id;
    if (s === newSelectedNode.id) neighbors.add(t);
    if (t === newSelectedNode.id) neighbors.add(s);
  });
  highlightNeighborhood.value = neighbors;
}, { immediate: true });

// Render D3 Simulation
let activeSimulation: d3.Simulation<any, any> | null = null;

const renderSimulation = () => {
  if (activeSimulation) {
    activeSimulation.stop();
  }

  if (!svgRef.value || filteredNodes.value.length === 0) return;

  const width = dimensions.value.width;
  const height = dimensions.value.height;

  const svg = d3.select(svgRef.value);
  
  // 保存当前缩放状态
  const currentGroupTransform = svg.select('g.graph-content');
  if (!currentGroupTransform.empty()) {
    const transform = d3.zoomTransform(svg.node() as any);
    currentTransform.value = transform;
  }
  
  svg.selectAll('*').remove(); // Flush previous canvas

  // Group element for zoom pan
  const mainGroup = svg.append('g').attr('class', 'graph-content');

  // Standard D3 zoom binding
  const zoom = d3.zoom()
    .scaleExtent([0.15, 4])
    .on('zoom', (event) => {
      mainGroup.attr('transform', event.transform);
    });

  zoomBehaviorRef.value = zoom;
  svg.call(zoom as any);
  
  // 恢复之前保存的缩放状态
  svg.call(zoom.transform as any, currentTransform.value);


  const linkPairKey = (s: string, t: string) => [s, t].sort().join('|');
  const pairLinkMap = new Map<string, { source: string; target: string; relations: string[]; relationLabels: string[] }>();

  filteredLinks.value.forEach(l => {
    const sId = typeof l.source === 'string' ? l.source : (l.source as any).id;
    const tId = typeof l.target === 'string' ? l.target : (l.target as any).id;
    const pairKey = linkPairKey(sId, tId);
    let entry = pairLinkMap.get(pairKey);
    if (!entry) {
      entry = { source: sId, target: tId, relations: [], relationLabels: [] };
      pairLinkMap.set(pairKey, entry);
    }
    if (!entry.relations.includes(l.relation)) entry.relations.push(l.relation);
    if (!entry.relationLabels.includes(l.relationLabel)) entry.relationLabels.push(l.relationLabel);
  });

  // Deep clones to prevent simulation side-effects; merge parallel edges into one label (e.g. 师从-交游)
  const simNodes = filteredNodes.value.map(n => ({ ...n }));
  const simLinks = Array.from(pairLinkMap.values()).map(e => ({
    source: e.source,
    target: e.target,
    relation: e.relations[0],
    relations: e.relations,
    relationLabel: e.relationLabels.join('-'),
  }));

  // Custom coloring maps
  const nodeColor = (node: any) => {
    const isHighlighted = highlightNeighborhood.value.size === 0 || highlightNeighborhood.value.has(node.id);

    if (props.selectedNode && props.selectedNode.id === node.id) {
      return '#8C2D19';
    }

    switch (node.type) {
      case 'Person':
        return isHighlighted ? '#412C1E' : '#B8AFA9';
      case 'School':
        return isHighlighted ? '#1E3F20' : '#BAC6BA';
      case 'ScriptStyle':
        return isHighlighted ? '#9E7415' : '#D1C6A5';
      case 'Location':
        return isHighlighted ? '#1F3447' : '#BCC8D1';
      default:
        return '#666';
    }
  };

  const nodeSize = (type: string) => {
    switch (type) {
      case 'Person': return 16;
      case 'School': return 13;
      case 'ScriptStyle': return 11;
      case 'Location': return 10;
      default: return 12;
    }
  };

  // Create force physics simulation
  const simulation = d3.forceSimulation(simNodes as any)
    .force('link', d3.forceLink(simLinks).id((d: any) => d.id).distance((link: any) => {
      const rels: string[] = link.relations ?? [link.relation];
      if (rels.some(r => r === 'ex:nativePlace' || r === 'ex:practicedStyle')) return 200;
      if (rels.some(r => r === 'ex:schoolMemberOf' || r === 'ex:founderOf')) return 140;
      return viewMode.value === 'person' ? 110 : 150;
    }))
    .force('charge', d3.forceManyBody().strength(viewMode.value === 'person' ? -420 : -750))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius((d: any) => nodeSize(d.type) + (viewMode.value === 'person' ? 28 : 40)));

  activeSimulation = simulation;

  // Draw Arrow Marker definitions
  svg.append('defs').selectAll('marker')
    .data(['arrow'])
    .enter().append('marker')
    .attr('id', d => d)
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 24)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-4L8,0L0,4')
    .attr('fill', '#A1978E');

  // 1. Render links
  const linkElements = mainGroup.append('g')
    .attr('class', 'links')
    .selectAll('g')
    .data(simLinks)
    .enter().append('g');

  const linkEndpointId = (endpoint: string | { id: string }) =>
    typeof endpoint === 'string' ? endpoint : endpoint.id;

  const paths = linkElements.append('line')
    .attr('stroke', '#E0DCD5')
    .attr('stroke-width', (d: any) => {
      const s = linkEndpointId(d.source);
      const t = linkEndpointId(d.target);
      const isFocus = highlightNeighborhood.value.size === 0 ||
        (highlightNeighborhood.value.has(s) && highlightNeighborhood.value.has(t));
      return isFocus ? 1.5 : 0.6;
    })
    .attr('stroke-dasharray', (d: any) => {
      const rels: string[] = d.relations ?? [d.relation];
      if (rels.some(r => r === 'ex:nativePlace' || r === 'ex:practicedStyle')) return '3,3';
      return 'none';
    })
    .attr('marker-end', 'url(#arrow)');

  const showAllLabels = viewMode.value !== 'person';
  const linkLabels = linkElements.append('text')
    .attr('font-size', '8px')
    .attr('fill', '#998D80')
    .attr('text-anchor', 'middle')
    .attr('opacity', (d: any) => {
      const s = linkEndpointId(d.source);
      const t = linkEndpointId(d.target);
      if (!showAllLabels) {
        const isFocus = highlightNeighborhood.value.has(s) && highlightNeighborhood.value.has(t);
        return isFocus ? 0.95 : 0;
      }
      if (highlightNeighborhood.value.size === 0) return 0.35;
      const isFocus = highlightNeighborhood.value.has(s) && highlightNeighborhood.value.has(t);
      return isFocus ? 1.0 : 0.08;
    })
    .text((d: any) => d.relationLabel);

  // 2. Render nodes
  const nodeElements = mainGroup.append('g')
    .attr('class', 'nodes')
    .selectAll('g')
    .data(simNodes)
    .enter().append('g')
    .attr('cursor', 'pointer')
    .on('click', (event, d: any) => {
      const originalNode = props.data.nodes.find(n => n.id === d.id);
      if (originalNode) emit('selectNode', originalNode);
    })
    .on('mouseover', (event, d: any) => {
      hoveredNode.value = props.data.nodes.find(n => n.id === d.id) || null;
    })
    .on('mouseleave', () => {
      hoveredNode.value = null;
    });

  // Outer ring for selected and hovered states
  nodeElements.append('circle')
    .attr('r', (d: any) => nodeSize(d.type) + 4)
    .attr('fill', 'none')
    .attr('stroke', '#E7DFD5')
    .attr('stroke-width', (d: any) => {
      if (props.selectedNode?.id === d.id) return 2.5;
      return 0;
    })
    .attr('stroke-opacity', 0.85);

  nodeElements.append('circle')
    .attr('r', (d: any) => nodeSize(d.type))
    .attr('fill', nodeColor)
    .attr('class', 'transition-colors duration-150')
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .attr('filter', 'drop-shadow(0px 1px 2px rgba(60, 50, 40, 0.15))');

  // Mini icon identifiers inside central nodes
  nodeElements.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '.3em')
    .attr('fill', '#fff')
    .attr('font-size', (d: any) => d.type === 'Person'||d.type === 'School' ? '6px' : '8px')
    .attr('font-weight', 'bold')
    .text((d: any) => {
      if (d.type === 'Person') return '印人';
      if (d.type === 'School') return '流派';
      if (d.type === 'ScriptStyle') return '墨';
      return '地';
    });

  // Custom Labels
  nodeElements.append('text')
    .attr('dx', (d: any) => nodeSize(d.type) + 6)
    .attr('dy', '.35em')
    .attr('font-size', (d: any) => d.type === 'Person' ? '11px' : '10px')
    .attr('font-weight', (d: any) => d.type === 'Person' ? 'bold' : 'normal')
    .attr('fill', (d: any) => {
      const isFocus = highlightNeighborhood.value.size === 0 || highlightNeighborhood.value.has(d.id);
      return isFocus ? '#2d241e' : '#a1978e';
    })
    .attr('opacity', (d: any) => {
      if (highlightNeighborhood.value.size === 0) return 1.0;
      return highlightNeighborhood.value.has(d.id) ? 1.0 : 0.25;
    })
    .text((d: any) => d.label);

  // Draggability behavior hook
  const drag = d3.drag<SVGGElement, any>()
    .on('start', (event, d) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on('drag', (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on('end', (event, d) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    });

  nodeElements.call(drag as any);

  // Update coordinates on tick
  simulation.on('tick', () => {
    paths
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y);

    linkLabels
      .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
      .attr('y', (d: any) => (d.source.y + d.target.y) / 2 - 3);

    nodeElements.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
  });
};

watch([filteredLinks, filteredNodes, dimensions, highlightNeighborhood, () => props.selectedNode, viewMode], () => {
  renderSimulation();
}, { flush: 'post' });

onMounted(() => {
  renderSimulation();
});

onBeforeUnmount(() => {
  if (activeSimulation) {
    activeSimulation.stop();
  }
});

const handleZoomIn = () => {
  if (zoomBehaviorRef.value && svgRef.value) {
    d3.select(svgRef.value).transition().call(zoomBehaviorRef.value.scaleBy, 1.3);
  }
};

const handleZoomOut = () => {
  if (zoomBehaviorRef.value && svgRef.value) {
    d3.select(svgRef.value).transition().call(zoomBehaviorRef.value.scaleBy, 0.7);
  }
};

const handleResetZoom = () => {
  if (zoomBehaviorRef.value && svgRef.value) {
    d3.select(svgRef.value).transition().call(
      zoomBehaviorRef.value.transform,
      d3.zoomIdentity
    );
  }
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden relative" id="graph_container">
    <div class="px-4 py-2 bg-white border-b border-[#E9E4DC] flex flex-wrap gap-2 items-center justify-between text-xs text-[#5C5246] font-sans shrink-0">
      <div class="flex rounded-md border border-[#E9E4DC] p-0.5 bg-[#FAF8F5]">
        <button
          type="button"
          @click="applyViewMode('person')"
          :class="['px-2.5 py-1 rounded text-[11px] cursor-pointer transition-colors', viewMode === 'person' ? 'bg-white shadow-sm text-[#8C2D19] font-medium' : 'hover:text-[#2D241E]']"
        >
          人物网络
        </button>
        <button
          type="button"
          @click="applyViewMode('school')"
          :class="['px-2.5 py-1 rounded text-[11px] cursor-pointer transition-colors', viewMode === 'school' ? 'bg-white shadow-sm text-[#8C2D19] font-medium' : 'hover:text-[#2D241E]']"
        >
          流派视图
        </button>
      </div>
      <p class="text-[10px] text-gray-400">
        {{ viewMode === 'person' ? '仅展示印人间师承、交游与血亲关系' : '展示印人与流派归属' }}
      </p>
    </div>

    <!-- Actual D3 drawing board -->
    <div ref="containerRef" class="flex-1 w-full bg-[#FAF7F2] relative overflow-hidden" style="min-height: 350px">
      <svg ref="svgRef" class="w-full h-full block" />

      <!-- Floating Zoom Console -->
      <div class="absolute right-3 bottom-3 flex flex-col gap-1 bg-white border border-[#E9E4DC] rounded-lg p-1 shadow-sm">
        <button
          @click="handleZoomIn"
          class="p-1.5 hover:bg-[#FAF7F2] text-[#5C5246] hover:text-[#2D241E] transition-colors rounded cursor-pointer"
          title="放大"
        >
          <ZoomIn class="w-4 h-4" />
        </button>
        <button
          @click="handleZoomOut"
          class="p-1.5 hover:bg-[#FAF7F2] text-[#5C5246] hover:text-[#2D241E] transition-colors rounded cursor-pointer"
          title="缩小"
        >
          <ZoomOut class="w-4 h-4" />
        </button>
        <button
          @click="handleResetZoom"
          class="p-1.5 hover:bg-[#FAF7F2] text-[#5C5246] hover:text-[#2D241E] transition-colors rounded border-t border-gray-100 cursor-pointer"
          title="重置"
        >
          <RotateCcw class="w-4 h-4" />
        </button>
      </div>

      <!-- Mini hover display -->
      <div v-if="hoveredNode" class="absolute left-3 top-3 p-2 bg-white/95 border border-[#8C2D19]/30 rounded-lg shadow-md max-w-sm pointer-events-none text-xs">
        <div class="font-bold text-[#8C2D19] font-serif">{{ hoveredNode.label }}</div>
        <div v-if="hoveredNode.dynasty" class="text-gray-700 mt-1 font-serif">朝代：{{ hoveredNode.dynasty }}</div>
        <div v-if="hoveredNode.intro" class="text-gray-500 text-[10px] line-clamp-2 mt-1 leading-relaxed border-t border-gray-100 pt-1 font-sans">{{ hoveredNode.intro }}</div>
      </div>
    </div>
  </div>
</template>
