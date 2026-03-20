import type { CSSProperties } from "react";
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";

/** Kanban column as returned by the board API */
export interface Column {
  id: string;
  name: string;
  color: string;
  columnType: string | null;
}

/** Full application detail as returned by GET /api/kanban/applications/[id] */
export interface ApplicationDetail {
  id: string;
  serialNumber: number;
  columnId: string;
  company: string;
  role: string;
  hiringManager: string | null;
  hiringOrg: string | null;
  postingNumber: string | null;
  postingUrl: string | null;
  locationType: string | null;
  primaryLocation: string | null;
  additionalLocations: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  bonusTargetPct: number | null;
  variableComp: number | null;
  referrals: string | null;
  datePosted: string | null;
  dateApplied: string | null;
  rejectionDate: string | null;
  closedReason: string | null;
  jobDescription: string | null;
  createdAt: string;
  updatedAt: string;
  interviews: Array<{
    id: string;
    type: string;
    format: string;
    people: string | null;
    date: string | null;
    notes: string | null;
    sortOrder: number;
  }>;
  notes: Array<{ id: string; content: string; createdAt: string }>;
  column: { id: string; name: string; columnType: string | null };
  statusLogs: Array<{ movedAt: string }>;
  scrapedJobId: string | null;
  scrapedJob: { removedAt: string | null } | null;
}

/** Card-level data used by ApplicationCard and drag/drop */
export interface ApplicationCardData {
  id: string;
  serialNumber: number;
  company: string;
  role: string;
  hiringManager: string | null;
  referrals: string | null;
  locationType: string | null;
  primaryLocation: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  bonusTargetPct: number | null;
  variableComp: number | null;
  updatedAt: string;
  _count: { interviews: number; notes: number };
  statusLogs: { movedAt: string }[];
  notes: { createdAt: string }[];
  interviews: { createdAt: string }[];
  resumeGenerations?: { reviewJson: string | null }[];
  scrapedJob?: { removedAt: string | null } | null;
}

/** Column with its applications, used by the board */
export interface ColumnData extends Column {
  applications: ApplicationCardData[];
}

/** Props passed by dnd-kit sortable wrappers to drag handle consumers */
export interface DragHandleProps {
  style: CSSProperties;
  listeners: DraggableSyntheticListeners;
  attributes: DraggableAttributes;
}
