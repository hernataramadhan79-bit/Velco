import { ItemSummary } from './item';

export type CapsuleRole = 'Host' | 'Member' | 'Web Snapshot';

export interface CapsuleRecord {
  id: string;
  name: string;
  description: string;
  role: CapsuleRole;
  encryptionKey: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
}

export interface CapsuleExportItem {
  id: string;
  type: string;
  title: string;
  content: string;
  excerpt: string;
  pinned: boolean;
  archived: boolean;
  trashed: boolean;
  createdAt: string;
  updatedAt: string;
  tags: Array<{ id: string; name: string; color: string }>;
  priority?: string | null;
  dueDate?: string | null;
  completed?: boolean | null;
}

export interface CapsuleExportBundle {
  capsule: CapsuleRecord;
  items: (ItemSummary | CapsuleExportItem)[];
  exportedAt: string;
  version: string;
}

export interface ConnectedPeer {
  peer_id: string;
  device_name: string;
  addr: string;
  connected_at: string;
}

export interface P2PStatus {
  is_active: boolean;
  active_capsule_id: string | null;
  peer_id: string;
  device_name: string;
  listen_port: number;
  connected_peers: ConnectedPeer[];
}
