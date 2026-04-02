import React, { useEffect, useRef, useState } from 'react';
import { Network, NodeType, MacroMetrics } from '../simulation/macro';

interface Props {
  network: Network;
  metrics?: MacroMetrics;
  onNetworkChange?: (network: Network) => void;
}

export function NetworkCanvas({ network, metrics, onNetworkChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<'view' | 'add_source' | 'add_sink' | 'add_intersection' | 'add_roundabout' | 'add_link'>('view');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && onNetworkChange) {
        if (selectedNode) {
          const newNodes = network.nodes.filter(n => n.id !== selectedNode);
          const newLinks = network.links.filter(l => l.source !== selectedNode && l.target !== selectedNode);
          onNetworkChange({ nodes: newNodes, links: newLinks });
          setSelectedNode(null);
        } else if (selectedLink) {
          const newLinks = network.links.filter(l => l.id !== selectedLink);
          onNetworkChange({ nodes: network.nodes, links: newLinks });
          setSelectedLink(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, selectedLink, network, onNetworkChange]);

  const networkRef = useRef(network);
  const metricsRef = useRef(metrics);
  const selectedNodeRef = useRef(selectedNode);
  const selectedLinkRef = useRef(selectedLink);

  useEffect(() => {
    networkRef.current = network;
    metricsRef.current = metrics;
    selectedNodeRef.current = selectedNode;
    selectedLinkRef.current = selectedLink;
  }, [network, metrics, selectedNode, selectedLink]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = (time: number) => {
      const currentNetwork = networkRef.current;
      const currentMetrics = metricsRef.current;
      const currentDensities = currentMetrics?.linkDensities;
      const modeFractions = currentMetrics?.modeFractions || { car: 1, bus: 0, bike: 0, pedestrian: 0 };
      const currentSelectedNode = selectedNodeRef.current;
      const currentSelectedLink = selectedLinkRef.current;

      const width = canvas.width;
      const height = canvas.height;
      
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, width, height);

      // Draw Links
      currentNetwork.links.forEach(link => {
        const source = currentNetwork.nodes.find(n => n.id === link.source);
        const target = currentNetwork.nodes.find(n => n.id === link.target);
        if (!source || !target) return;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const length = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);

        let color = '#64748b'; // default slate-500
        let density = 0;
        if (currentDensities && currentDensities[link.id] !== undefined) {
          density = currentDensities[link.id];
          // Green to Red based on density (0 to 1)
          const r = Math.min(255, Math.floor(density * 2 * 255));
          const g = Math.min(255, Math.floor((1 - density) * 2 * 255));
          color = `rgb(${r}, ${g}, 0)`;
        }

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);

        if (link.type === 'tunnel') {
          ctx.strokeStyle = color;
          ctx.setLineDash([10, 10]);
        } else {
          ctx.strokeStyle = color;
          ctx.setLineDash([]);
        }
        
        if (currentSelectedLink === link.id) {
          ctx.strokeStyle = '#fff';
        }
        
        ctx.lineWidth = link.lanes * 4;
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw moving vehicles
        const speedFactor = Math.max(0.05, 1 - density); // Even in jam, move slightly
        const speed = (link.vFree / 60) * speedFactor * 50; // Pixels per second
        
        ctx.save();
        ctx.translate(source.x, source.y);
        ctx.rotate(angle);

        if (density > 0.05) {
            const spacing = Math.max(12, 50 * (1 - density)); 
            const currentOffset = (time / 1000 * speed) % spacing;
            
            for (let d = currentOffset; d < length - 10; d += spacing) {
                // Pseudo-random type based on position and link ID
                const hash = Math.abs(Math.sin(d * 12.9898 + link.id.charCodeAt(0)) * 43758.5453);
                const rand = hash - Math.floor(hash);
                
                let type = 'car';
                if (rand < modeFractions.pedestrian) type = 'pedestrian';
                else if (rand < modeFractions.pedestrian + modeFractions.bike) type = 'bike';
                else if (rand < modeFractions.pedestrian + modeFractions.bike + modeFractions.bus) type = 'bus';

                for (let l = 0; l < link.lanes; l++) {
                    const laneOffset = (l - (link.lanes - 1) / 2) * 4;
                    
                    if (type === 'pedestrian') {
                        // Draw pedestrians on the edge (sidewalk)
                        ctx.fillStyle = '#fef08a'; // yellow
                        const edgeOffset = (link.lanes / 2) * 4 + 2;
                        ctx.beginPath();
                        ctx.arc(d, edgeOffset, 1.5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.arc(d, -edgeOffset, 1.5, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (type === 'bike') {
                        // Draw bikes on the rightmost lane
                        if (l === link.lanes - 1) {
                            ctx.fillStyle = '#4ade80'; // green
                            ctx.fillRect(d, laneOffset + 1, 3, 1.5);
                        }
                    } else if (type === 'bus') {
                        ctx.fillStyle = '#60a5fa'; // blue
                        ctx.fillRect(d, laneOffset - 1.5, 12, 3);
                    } else {
                        // Car
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                        ctx.fillRect(d, laneOffset - 1, 6, 2);
                    }
                }
            }
        }

        ctx.restore();
      });

      // Draw Nodes
      currentNetwork.nodes.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 15, 0, Math.PI * 2);
        
        if (node.type === 'source') ctx.fillStyle = '#3b82f6'; // blue
        else if (node.type === 'sink') ctx.fillStyle = '#ef4444'; // red
        else if (node.type === 'roundabout') ctx.fillStyle = '#10b981'; // emerald
        else ctx.fillStyle = '#f59e0b'; // amber (intersection)
        
        ctx.fill();
        ctx.strokeStyle = currentSelectedNode === node.id ? '#fff' : '#cbd5e1';
        ctx.lineWidth = currentSelectedNode === node.id ? 3 : 2;
        ctx.stroke();
        
        // Label
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.type.substring(0, 1).toUpperCase(), node.x, node.y);
      });

      animationFrameId = window.requestAnimationFrame(render);
    };

    render(performance.now());

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onNetworkChange) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Check if clicked on a node
    const clickedNode = network.nodes.find(n => Math.hypot(n.x - x, n.y - y) < 20);

    let clickedLink = null;
    if (!clickedNode) {
      clickedLink = network.links.find(l => {
        const source = network.nodes.find(n => n.id === l.source);
        const target = network.nodes.find(n => n.id === l.target);
        if (!source || !target) return false;
        
        const A = x - source.x;
        const B = y - source.y;
        const C = target.x - source.x;
        const D = target.y - source.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;
        
        let xx, yy;
        if (param < 0) {
          xx = source.x;
          yy = source.y;
        } else if (param > 1) {
          xx = target.x;
          yy = target.y;
        } else {
          xx = source.x + param * C;
          yy = source.y + param * D;
        }
        
        const dx = x - xx;
        const dy = y - yy;
        return Math.sqrt(dx * dx + dy * dy) < 10;
      });
    }

    if (mode === 'add_link') {
      if (clickedNode) {
        if (!selectedNode) {
          setSelectedNode(clickedNode.id);
          setSelectedLink(null);
        } else if (selectedNode !== clickedNode.id) {
          // Create link
          const newLink = {
            id: `l${Date.now()}`,
            source: selectedNode,
            target: clickedNode.id,
            type: 'road' as const,
            lanes: 2,
            length: 1,
            vFree: 60,
            capacity: 1800
          };
          onNetworkChange({ ...network, links: [...network.links, newLink] });
          setSelectedNode(null);
          setMode('view');
        }
      } else {
        setSelectedNode(null);
      }
    } else if (mode !== 'view') {
      // Add node
      const typeMap: Record<string, NodeType> = {
        'add_source': 'source',
        'add_sink': 'sink',
        'add_intersection': 'intersection',
        'add_roundabout': 'roundabout'
      };
      
      const newNode = {
        id: `n${Date.now()}`,
        type: typeMap[mode],
        x,
        y,
        ...(typeMap[mode] === 'source' ? { inflow: 1000 } : {}),
        ...(typeMap[mode] === 'intersection' ? { cycleLength: 60, greenSplit: 0.5 } : {})
      };
      
      onNetworkChange({ ...network, nodes: [...network.nodes, newNode] });
      setMode('view');
    } else {
      setSelectedNode(clickedNode ? clickedNode.id : null);
      setSelectedLink(clickedLink ? clickedLink.id : null);
    }
  };

  const selectedNodeData = selectedNode ? network.nodes.find(n => n.id === selectedNode) : null;
  const selectedLinkData = selectedLink ? network.links.find(l => l.id === selectedLink) : null;

  return (
    <div className="w-full h-full flex flex-col gap-2">
      <div className="flex gap-2">
        <button onClick={() => setMode('view')} className={`px-2 py-1 text-xs rounded ${mode === 'view' ? 'bg-blue-500 text-white' : 'bg-slate-100'}`}>Select</button>
        <button onClick={() => setMode('add_source')} className={`px-2 py-1 text-xs rounded ${mode === 'add_source' ? 'bg-blue-500 text-white' : 'bg-slate-100'}`}>+ Source</button>
        <button onClick={() => setMode('add_sink')} className={`px-2 py-1 text-xs rounded ${mode === 'add_sink' ? 'bg-blue-500 text-white' : 'bg-slate-100'}`}>+ Sink</button>
        <button onClick={() => setMode('add_intersection')} className={`px-2 py-1 text-xs rounded ${mode === 'add_intersection' ? 'bg-blue-500 text-white' : 'bg-slate-100'}`}>+ Intersection</button>
        <button onClick={() => setMode('add_roundabout')} className={`px-2 py-1 text-xs rounded ${mode === 'add_roundabout' ? 'bg-blue-500 text-white' : 'bg-slate-100'}`}>+ Roundabout</button>
        <button onClick={() => setMode('add_link')} className={`px-2 py-1 text-xs rounded ${mode === 'add_link' ? 'bg-blue-500 text-white' : 'bg-slate-100'}`}>+ Link</button>
        {(selectedNode || selectedLink) && (
          <button 
            onClick={() => {
              if (onNetworkChange) {
                if (selectedNode) {
                  const newNodes = network.nodes.filter(n => n.id !== selectedNode);
                  const newLinks = network.links.filter(l => l.source !== selectedNode && l.target !== selectedNode);
                  onNetworkChange({ nodes: newNodes, links: newLinks });
                  setSelectedNode(null);
                } else if (selectedLink) {
                  const newLinks = network.links.filter(l => l.id !== selectedLink);
                  onNetworkChange({ nodes: network.nodes, links: newLinks });
                  setSelectedLink(null);
                }
              }
            }} 
            className="px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600 ml-2"
          >
            Delete Selected
          </button>
        )}
        <div className="flex-1"></div>
        <button 
          onClick={() => onNetworkChange && onNetworkChange({ nodes: [], links: [] })} 
          className="px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100"
        >
          Clear Network
        </button>
      </div>
      <div className="flex-1 bg-slate-900 rounded-xl overflow-hidden shadow-inner border border-slate-700 relative">
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={600} 
          onClick={handleCanvasClick}
          className={`w-full h-full object-contain ${mode !== 'view' ? 'cursor-crosshair' : 'cursor-default'}`}
        />
        
        {/* Properties Panel */}
        {(selectedNodeData || selectedLinkData) && (
          <div className="absolute top-4 right-4 bg-slate-800/90 text-white p-4 rounded-xl shadow-lg backdrop-blur-sm border border-slate-700 w-64 pointer-events-auto">
            <h3 className="font-semibold mb-3 text-sm border-b border-slate-600 pb-2">
              {selectedNodeData ? `${selectedNodeData.type.toUpperCase()} Properties` : 'LINK Properties'}
            </h3>
            
            {selectedNodeData && selectedNodeData.type === 'source' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Cars (veh/h)</label>
                  <input 
                    type="number" 
                    value={selectedNodeData.inflowProfile?.car ?? selectedNodeData.inflow ?? 1000}
                    onChange={(e) => {
                      if (!onNetworkChange) return;
                      const val = parseInt(e.target.value) || 0;
                      const currentProfile = selectedNodeData.inflowProfile || { car: selectedNodeData.inflow || 1000, bus: 0, bike: 0, pedestrian: 0 };
                      const newNodes = network.nodes.map(n => n.id === selectedNodeData.id ? { ...n, inflowProfile: { ...currentProfile, car: val } } : n);
                      onNetworkChange({ ...network, nodes: newNodes });
                    }}
                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Buses (veh/h)</label>
                  <input 
                    type="number" 
                    value={selectedNodeData.inflowProfile?.bus ?? 0}
                    onChange={(e) => {
                      if (!onNetworkChange) return;
                      const val = parseInt(e.target.value) || 0;
                      const currentProfile = selectedNodeData.inflowProfile || { car: selectedNodeData.inflow || 1000, bus: 0, bike: 0, pedestrian: 0 };
                      const newNodes = network.nodes.map(n => n.id === selectedNodeData.id ? { ...n, inflowProfile: { ...currentProfile, bus: val } } : n);
                      onNetworkChange({ ...network, nodes: newNodes });
                    }}
                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Bikes (veh/h)</label>
                  <input 
                    type="number" 
                    value={selectedNodeData.inflowProfile?.bike ?? 0}
                    onChange={(e) => {
                      if (!onNetworkChange) return;
                      const val = parseInt(e.target.value) || 0;
                      const currentProfile = selectedNodeData.inflowProfile || { car: selectedNodeData.inflow || 1000, bus: 0, bike: 0, pedestrian: 0 };
                      const newNodes = network.nodes.map(n => n.id === selectedNodeData.id ? { ...n, inflowProfile: { ...currentProfile, bike: val } } : n);
                      onNetworkChange({ ...network, nodes: newNodes });
                    }}
                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Pedestrians (ppl/h)</label>
                  <input 
                    type="number" 
                    value={selectedNodeData.inflowProfile?.pedestrian ?? 0}
                    onChange={(e) => {
                      if (!onNetworkChange) return;
                      const val = parseInt(e.target.value) || 0;
                      const currentProfile = selectedNodeData.inflowProfile || { car: selectedNodeData.inflow || 1000, bus: 0, bike: 0, pedestrian: 0 };
                      const newNodes = network.nodes.map(n => n.id === selectedNodeData.id ? { ...n, inflowProfile: { ...currentProfile, pedestrian: val } } : n);
                      onNetworkChange({ ...network, nodes: newNodes });
                    }}
                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {selectedLinkData && (
              <>
                <div className="mb-3">
                  <label className="block text-xs text-slate-400 mb-1">Lanes</label>
                  <input 
                    type="number" 
                    min="1"
                    max="6"
                    value={selectedLinkData.lanes}
                    onChange={(e) => {
                      if (!onNetworkChange) return;
                      const val = Math.max(1, parseInt(e.target.value) || 1);
                      const newLinks = network.links.map(l => l.id === selectedLinkData.id ? { ...l, lanes: val } : l);
                      onNetworkChange({ ...network, links: newLinks });
                    }}
                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-xs text-slate-400 mb-1">Free Speed (km/h)</label>
                  <input 
                    type="number" 
                    value={selectedLinkData.vFree}
                    onChange={(e) => {
                      if (!onNetworkChange) return;
                      const val = Math.max(10, parseInt(e.target.value) || 60);
                      const newLinks = network.links.map(l => l.id === selectedLinkData.id ? { ...l, vFree: val } : l);
                      onNetworkChange({ ...network, links: newLinks });
                    }}
                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </>
            )}
          </div>
        )}

        <div className="absolute bottom-4 left-4 flex flex-col gap-2 text-xs text-slate-300 bg-slate-800/80 p-3 rounded-lg backdrop-blur-sm pointer-events-none">
          <div className="flex gap-4">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Source</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"></div> Sink</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-amber-500"></div> Intersection</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Roundabout</div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span>Density:</span>
            <div className="w-24 h-2 rounded bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
