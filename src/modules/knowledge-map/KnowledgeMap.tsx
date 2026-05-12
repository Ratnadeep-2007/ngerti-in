"use client";

import { useEffect, useState, useRef } from "react";
// @ts-ignore
import ForceGraph2D from "react-force-graph-2d";

interface Node {
  id: string;
  name: string;
  val: number;
}

interface Link {
  source: string;
  target: string;
}

export function KnowledgeMap() {
  const [data, setData] = useState<{ nodes: Node[]; links: Link[] }>({
    nodes: [],
    links: [],
  });

  useEffect(() => {
    // Sample static data for now
    setData({
      nodes: [
        { id: "math", name: "Mathematics", val: 5 },
        { id: "algebra", name: "Algebra", val: 3 },
        { id: "calculus", name: "Calculus", val: 2 },
      ],
      links: [
        { source: "math", target: "algebra" },
        { source: "math", target: "calculus" },
      ],
    });
  }, []);

  return (
    <div style={{ height: "400px", width: "100%" }}>
      <ForceGraph2D
        graphData={data}
        nodeLabel="name"
        nodeAutoColorBy="group"
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={(d: any) => d.value * 0.001}
      />
    </div>
  );
}
