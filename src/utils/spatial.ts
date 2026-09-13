import type { OperatingSystemNode } from '../types/os';

export class SpatialNodeGrid {
  private cellSize: number;
  private grid: Map<string, OperatingSystemNode[]>;

  constructor(cellSize = 350) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  private getKey(cx: number, cy: number): string {
    return `${cx}:${cy}`;
  }

  rebuild(nodes: OperatingSystemNode[]): void {
    this.grid.clear();
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.x === undefined || n.y === undefined) continue;
      const cx = Math.floor(n.x / this.cellSize);
      const cy = Math.floor(n.y / this.cellSize);
      const key = this.getKey(cx, cy);
      let list = this.grid.get(key);
      if (!list) {
        list = [];
        this.grid.set(key, list);
      }
      list.push(n);
    }
  }

  findClosest(x: number, y: number, maxDist: number): OperatingSystemNode | null {
    const minCx = Math.floor((x - maxDist) / this.cellSize);
    const maxCx = Math.floor((x + maxDist) / this.cellSize);
    const minCy = Math.floor((y - maxDist) / this.cellSize);
    const maxCy = Math.floor((y + maxDist) / this.cellSize);

    let closest: OperatingSystemNode | null = null;
    let minDist = maxDist;
    let minDistSq = maxDist * maxDist;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const cell = this.grid.get(this.getKey(cx, cy));
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const n = cell[i];
          const dx = (n.x || 0) - x;
          if (Math.abs(dx) >= minDist) continue;
          const dy = (n.y || 0) - y;
          if (Math.abs(dy) >= minDist) continue;
          const distSq = dx * dx + dy * dy;
          if (distSq < minDistSq) {
            minDistSq = distSq;
            minDist = Math.sqrt(minDistSq);
            closest = n;
          }
        }
      }
    }

    return closest;
  }
}
