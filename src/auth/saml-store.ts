/**
 * INTRACLAW — SAML Config Store (Phase R2)
 * Persists per-tenant IdP configurations in SQLite.
 */
import * as crypto from 'crypto';
import { getDb } from '../db';
import type { SAMLConfig } from './saml';

// ── Row mapping ──────────────────────────────────────────────────────────────

interface SAMLRow {
  id: string;
  tenant_id: string;
  idp_metadata_url: string | null;
  idp_metadata_xml: string | null;
  idp_entity_id: string;
  created_at: string;
}

function rowToConfig(row: SAMLRow): SAMLConfig {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    idpMetadataUrl: row.idp_metadata_url,
    idpMetadataXml: row.idp_metadata_xml,
    idpEntityId: row.idp_entity_id,
    createdAt: row.created_at,
  };
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export function createSAMLConfig(
  tenantId: string,
  idpEntityId: string,
  metadataUrl?: string,
  metadataXml?: string
): SAMLConfig {
  if (!metadataUrl && !metadataXml) {
    throw new Error('Either metadataUrl or metadataXml is required');
  }

  const db = getDb();
  const id = crypto.randomUUID();

  db.prepare(`
    INSERT INTO saml_configs (id, tenant_id, idp_entity_id, idp_metadata_url, idp_metadata_xml)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, tenantId, idpEntityId, metadataUrl ?? null, metadataXml ?? null);

  const row = db.prepare('SELECT * FROM saml_configs WHERE id = ?').get(id) as SAMLRow;
  return rowToConfig(row);
}

export function getSAMLConfig(tenantId: string): SAMLConfig | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM saml_configs WHERE tenant_id = ?').get(tenantId) as SAMLRow | undefined;
  return row ? rowToConfig(row) : null;
}

export function listSAMLConfigs(): SAMLConfig[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM saml_configs ORDER BY created_at DESC').all() as SAMLRow[];
  return rows.map(rowToConfig);
}

export function deleteSAMLConfig(id: string): void {
  getDb().prepare('DELETE FROM saml_configs WHERE id = ?').run(id);
}
