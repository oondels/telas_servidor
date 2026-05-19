import { DataSource, EntityManager } from "typeorm";
import { AuditEventOrmEntity } from "../../../infrastructure/database/entities/audit-event.entity.js";
import { toBahiaSqlDateTime } from "../../../shared/utils/date.js";
import { CreateAuditEventInput, SearchAuditEventsInput } from "../application/audit-event.dto.js";

export class TypeOrmAuditEventsRepository {
  constructor(private readonly dataSource: DataSource) {}

  async create(input: CreateAuditEventInput, manager?: EntityManager) {
    const repository = (manager ?? this.dataSource).getRepository(AuditEventOrmEntity);
    const entity = repository.create({
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      actor_matricula: input.actorMatricula ? String(input.actorMatricula) : null,
      actor_usuario: input.actorUsuario ? input.actorUsuario.trim().toUpperCase() : null,
      before_state: input.beforeState ?? null,
      after_state: input.afterState ?? null,
      metadata: input.metadata ?? null,
      created_at: new Date(toBahiaSqlDateTime()),
    });

    return repository.save(entity);
  }

  async search(input: SearchAuditEventsInput) {
    const params: unknown[] = [];
    const where: string[] = [];

    if (input.entityType) {
      params.push(String(input.entityType).trim().toUpperCase());
      where.push(`UPPER(entity_type) = $${params.length}`);
    }

    if (input.entityId) {
      params.push(String(input.entityId).trim());
      where.push(`entity_id = $${params.length}`);
    }

    if (input.action) {
      params.push(String(input.action).trim().toUpperCase());
      where.push(`UPPER(action) = $${params.length}`);
    }

    if (input.actorMatricula) {
      params.push(input.actorMatricula);
      where.push(`actor_matricula = $${params.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const offset = (input.page - 1) * input.itemsPerPage;

    const [countRows, rows] = await Promise.all([
      this.dataSource.query(
        `SELECT COUNT(*)::int AS total FROM fabrica.telas_audit_events ${whereClause}`,
        params,
      ),
      this.dataSource.query(
        `
          SELECT *
          FROM fabrica.telas_audit_events
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT $${params.length + 1}
          OFFSET $${params.length + 2}
        `,
        [...params, input.itemsPerPage, offset],
      ),
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    return {
      events: rows,
      total,
      page: input.page,
      itemsPerPage: input.itemsPerPage,
      totalPages: total > 0 ? Math.ceil(total / input.itemsPerPage) : 0,
    };
  }
}
