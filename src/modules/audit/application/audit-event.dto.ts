export interface CreateAuditEventInput {
  entityType: string;
  entityId: string;
  action: string;
  actorMatricula?: number | null;
  actorUsuario?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface SearchAuditEventsInput {
  entityType?: string | null;
  entityId?: string | null;
  action?: string | null;
  actorMatricula?: number | null;
  page: number;
  itemsPerPage: number;
}
