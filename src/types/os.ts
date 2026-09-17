export type OperatingSystemFamily =
  | 'unix'
  | 'bsd'
  | 'linux'
  | 'windows'
  | 'apple'
  | 'independent';

export type KernelType =
  | 'monolithic'
  | 'microkernel'
  | 'hybrid'
  | 'nanokernel'
  | 'exokernel'
  | 'simple';

export type SystemStatus = 'active' | 'discontinued' | 'historic';

export type RelationType = 'based_on' | 'kernel_fork' | 'reimplementation';

export interface OperatingSystemNode {
  id: string;
  name: string;
  family: OperatingSystemFamily;
  kernelType: KernelType;
  kernelName: string;
  inceptionYear: number;
  developer: string;
  license: string;
  status: SystemStatus;
  architectures: string[];
  wikipediaTitle: string;
  wikidataId?: string;
  description?: string;
  significance: number;
  sitelinks?: number;
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  vx?: number;
  vy?: number;
}

export interface LineageLink {
  source: string | OperatingSystemNode;
  target: string | OperatingSystemNode;
  relationType: RelationType;
}

export interface GraphDataset {
  nodes: OperatingSystemNode[];
  links: LineageLink[];
}

export interface WikipediaPhoto {
  url: string;
  sourceLang: string;
  badge: string;
}

export interface WikipediaSummary {
  title: string;
  extract: string;
  thumbnailUrl?: string;
  pageUrl: string;
  lang?: string;
  isFallback?: boolean;
  requestedLang?: string;
  album?: string[];
  albumPhotos?: WikipediaPhoto[];
}

export interface FilterOptions {
  searchQuery: string;
  selectedFamilies: OperatingSystemFamily[];
  yearRange: [number, number];
}

export interface LineageSubtree {
  ancestorNodeIds: Set<string>;
  descendantNodeIds: Set<string>;
  ancestorLinks: Set<LineageLink>;
  descendantLinks: Set<LineageLink>;
}
