<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import * as d3 from 'd3';
import type { GraphData, GraphNode } from '../types';
import { Filter, ZoomIn, ZoomOut, RotateCcw } from 'lucide-vue-next';

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

const showRelations = ref({
  family: true,
  mentorship: true,
  friendship: true,
  school: true,
  style: true,
  native: true,
});

const hoveredNode = ref<GraphNode | null>(null);
const highlightNeighborhood = ref<Set<string>>(new Set());
const dimensions = ref({ width: 600, height: 500 });
const zoomBehaviorRef = ref<any>(null);

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

// Extract unique nodes and build filtered nodes list
const filteredNodes = computed(() => {
  const activeNodeIds = new Set<string>();
  filteredLinks.value.forEach(l => {
    activeNodeIds.add(typeof l.source === 'string' ? l.source : (l.source as any).id);
    activeNodeIds.add(typeof l.target === 'string' ? l.target : (l.target as any).id);
  });

  return props.data.nodes.filter(n => {
    if (n.type === 'Person') return true;
    return activeNodeIds.has(n.id);
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

  // Deep clones to prevent simulation side-effects
  const simNodes = filteredNodes.value.map(n => ({ ...n }));
  const simLinks = filteredLinks.value.map(l => {
    const sId = typeof l.source === 'string' ? l.source : (l.source as any).id;
    const tId = typeof l.target === 'string' ? l.target : (l.target as any).id;
    return {
      source: sId,
      target: tId,
      relation: l.relation,
      relationLabel: l.relationLabel
    };
  });

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
      // Heavily shared categorical hubs (styles, places, schools) require much longer connections to prevent overlap
      if (link.relation === 'ex:nativePlace' || link.relation === 'ex:practicedStyle') {
        return 230;
      }
      if (link.relation === 'ex:schoolMemberOf' || link.relation === 'ex:founderOf') {
        return 190;
      }
      return 160;
    }))
    .force('charge', d3.forceManyBody().strength(-950))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius((d: any) => nodeSize(d.type) + 45));

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

  const paths = linkElements.append('line')
    .attr('stroke', '#E0DCD5')
    .attr('stroke-width', (d: any) => {
      const isFocus = highlightNeighborhood.value.size === 0 ||
        (highlightNeighborhood.value.has(d.source) && highlightNeighborhood.value.has(d.target));
      return isFocus ? 1.5 : 0.6;
    })
    .attr('stroke-dasharray', (d: any) => {
      if (d.relation === 'ex:nativePlace' || d.relation === 'ex:practicedStyle') return '3,3';
      return 'none';
    })
    .attr('marker-end', 'url(#arrow)');

  const linkLabels = linkElements.append('text')
    .attr('font-size', '8px')
    .attr('fill', '#998D80')
    .attr('text-anchor', 'middle')
    .attr('opacity', (d: any) => {
      if (highlightNeighborhood.value.size === 0) return 0.45;
      // Fade out labels on non-focus paths
      const isFocus = highlightNeighborhood.value.has(d.source) && highlightNeighborhood.value.has(d.target);
      return isFocus ? 1.0 : 0.1;
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
    .attr('font-size', '8px')
    .attr('font-weight', 'bold')
    .text((d: any) => {
      if (d.type === 'Person') return '印';
      if (d.type === 'School') return '派';
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

watch([filteredLinks, filteredNodes, dimensions, highlightNeighborhood, () => props.selectedNode], () => {
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
  <div class="flex flex-col h-full bg-[#FCFAF7] border border-[#E9E4DC] rounded-xl shadow-sm overflow-hidden relative" id="graph_container">
    <!-- Upper filter bar -->
    <div class="px-4 py-3 bg-[#F4EFE6] border-b border-[#E9E4DC] flex flex-wrap gap-2 md:gap-4 items-center justify-between text-xs text-[#5C5246] font-sans">
      <div class="flex items-center gap-1.5 font-medium">
        <Filter class="w-3.5 h-3.5 text-[#8C2D19]" />
        <span>金石关系拓扑层展示</span>
      </div>
      <div class="flex flex-wrap gap-3">
        <label class="flex items-center gap-1 cursor-pointer hover:text-[#2D241E]">
          <input
            type="checkbox"
            v-model="showRelations.family"
            class="rounded border-[#C1B5A3] text-[#8C2D19] focus:ring-[#8C2D19] w-3.5 h-3.5 cursor-pointer"
          />
          <span>血亲</span>
        </label>
        <label class="flex items-center gap-1 cursor-pointer hover:text-[#2D241E]">
          <input
            type="checkbox"
            v-model="showRelations.mentorship"
            class="rounded border-[#C1B5A3] text-[#8C2D19] focus:ring-[#8C2D19] w-3.5 h-3.5 cursor-pointer"
          />
          <span>师承</span>
        </label>
        <label class="flex items-center gap-1 cursor-pointer hover:text-[#2D241E]">
          <input
            type="checkbox"
            v-model="showRelations.friendship"
            class="rounded border-[#C1B5A3] text-[#8C2D19] focus:ring-[#8C2D19] w-3.5 h-3.5 cursor-pointer"
          />
          <span>交游</span>
        </label>
        <label class="flex items-center gap-1 cursor-pointer hover:text-[#2D241E]">
          <input
            type="checkbox"
            v-model="showRelations.school"
            class="rounded border-[#C1B5A3] text-[#8C2D19] focus:ring-[#8C2D19] w-3.5 h-3.5 cursor-pointer"
          />
          <span>印派</span>
        </label>
        <label class="flex items-center gap-1 cursor-pointer hover:text-[#2D241E]">
          <input
            type="checkbox"
            v-model="showRelations.style"
            class="rounded border-[#C1B5A3] text-[#8C2D19] focus:ring-[#8C2D19] w-3.5 h-3.5 cursor-pointer"
          />
          <span>印风</span>
        </label>
        <label class="flex items-center gap-1 cursor-pointer hover:text-[#2D241E]">
          <input
            type="checkbox"
            v-model="showRelations.native"
            class="rounded border-[#C1B5A3] text-[#8C2D19] focus:ring-[#8C2D19] w-3.5 h-3.5 cursor-pointer"
          />
          <span>籍地</span>
        </label>
      </div>
    </div>

    <!-- Actual D3 drawing board -->
    <div ref="containerRef" class="flex-1 w-full bg-[#FAF7F2] relative overflow-hidden" style="min-height: 350px">
      <svg ref="svgRef" class="w-full h-full block" />

      <!-- Legend -->
      <div class="absolute left-3 bottom-3 p-2.5 bg-white/90 border border-[#E9E4DC] rounded-lg shadow-sm text-[10px] space-y-1.5 pointer-events-none text-[#5C5246] max-w-[130px] font-sans">
        <div class="font-bold border-b border-gray-100 pb-1 mb-1 text-center">图例要素</div>
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-[#412C1E] inline-block" />
          <span>人物 (印生)</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-[#1E3F20] inline-block" />
          <span>印社流派</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-[#9E7415] inline-block" />
          <span>金石印风</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-[#1F3447] inline-block" />
          <span>地理籍贯</span>
        </div>
      </div>

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
