"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { Loader2, Zap } from "lucide-react";

// Dynamically import force-graph to avoid SSR issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[400px] w-full bg-neutral-50 rounded-xl border border-dashed">
      <Loader2 className="size-8 animate-spin text-blue-600" />
    </div>
  ),
});

const KnowledgeMap = () => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.meetings.getKnowledgeMap.queryOptions());
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.offsetWidth,
        height: 400,
      });
    }
  }, []);

  const graphData = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    return data;
  }, [data]);

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex flex-col gap-y-4">
        <div className="flex items-center gap-2">
          <Zap className="size-5 text-blue-600" />
          <h3 className="text-xl font-bold">Smart Knowledge Map</h3>
        </div>
        <div className="flex flex-col items-center justify-center h-[400px] w-full bg-neutral-50 rounded-xl border border-dashed text-neutral-500">
          <p>Not enough data to map your knowledge yet.</p>
          <p className="text-xs">Complete more study sessions to see your map grow!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-4" ref={containerRef}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="size-5 text-blue-600" />
          <h3 className="text-xl font-bold">Smart Knowledge Map</h3>
        </div>
        <div className="text-xs text-neutral-500 bg-blue-50 px-2 py-1 rounded-full border border-blue-100">
          {data.nodes.length} Topics Mastered
        </div>
      </div>
      
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden relative group">
        <ForceGraph2D
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          nodeLabel="id"
          nodeAutoColorBy="group"
          linkDirectionalParticles={2}
          linkDirectionalParticleSpeed={(d: any) => d.value * 0.001}
          nodeCanvasObject={(node: any, ctx: any, globalScale: any) => {
            const label = node.id;
            const fontSize = 12 / globalScale;
            ctx.font = `${fontSize}px Sans-Serif`;
            const textWidth = ctx.measureText(label).width;
            const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, ...bckgDimensions);

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = node.color;
            ctx.fillText(label, node.x, node.y);

            node.__bckgDimensions = bckgDimensions;
          }}
          nodePointerAreaPaint={(node: any, color: any, ctx: any) => {
            ctx.fillStyle = color;
            const bckgDimensions = node.__bckgDimensions;
            bckgDimensions && ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, ...bckgDimensions);
          }}
        />
        
        <div className="absolute bottom-4 left-4 right-4 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
           <p className="text-[10px] text-neutral-400 text-center">
             Nodes are topics. Links show topics studied together. Larger nodes indicate more frequent study.
           </p>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeMap;
