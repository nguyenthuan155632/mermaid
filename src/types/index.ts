export interface Diagram {
  id: string;
  userId: string;
  title: string;
  code: string;
  description: string | null;
  isPublic: boolean;
  shareToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiagramSnapshot {
  id: string;
  diagramId: string;
  title: string;
  code: string;
  description: string | null;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  password: string;
  createdAt: Date;
}

export interface SampleDiagram {
  id: string;
  title: string;
  code: string;
  description: string | null;
  category: string;
  order: number;
  createdAt: Date;
}
