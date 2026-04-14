/**
 * INTRACLAW — SAML 2.0 helpers (Phase R2)
 * SP = IntraClaw, IdP = customer's Okta / Azure AD / Google Workspace
 */
import * as samlify from 'samlify';
import * as https from 'https';
import * as http from 'http';

export interface SAMLConfig {
  id: string;
  tenantId: string;
  idpMetadataUrl: string | null;
  idpMetadataXml: string | null;
  idpEntityId: string;
  createdAt: string;
}

// ── SP settings ─────────────────────────────────────────────────────────────

export function getSPEntityId(): string {
  return process.env.SAML_SP_ENTITY_ID ?? 'https://intraclaw.example.com';
}

export function getACSUrl(): string {
  return process.env.SAML_SP_ACS_URL ?? 'http://localhost:3001/auth/saml/callback';
}

// ── Factory helpers ──────────────────────────────────────────────────────────

export function createSP(): unknown {
  const sp = samlify.ServiceProvider({
    entityID: getSPEntityId(),
    assertionConsumerService: [
      {
        Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
        Location: getACSUrl(),
      },
    ],
    wantAssertionsSigned: false,
    authnRequestsSigned: false,
  });
  return sp;
}

export function createIdP(metadataXml: string): unknown {
  const idp = samlify.IdentityProvider({
    metadata: metadataXml,
    wantAuthnRequestsSigned: false,
  });
  return idp;
}

// ── Metadata fetch ───────────────────────────────────────────────────────────

export function fetchIdpMetadata(metadataUrl: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const protocol = metadataUrl.startsWith('https') ? https : http;
    protocol.get(metadataUrl, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ── Assertion parsing ────────────────────────────────────────────────────────

interface SPInstance {
  parseLoginResponse: (
    idp: unknown,
    binding: string,
    request: { body: Record<string, string> }
  ) => Promise<{ extract: { attributes: Record<string, unknown>; nameID?: string; nameid?: string } }>;
}

export async function parseAssertion(
  sp: unknown,
  idp: unknown,
  body: Record<string, string>
): Promise<{ email: string; nameId: string; attributes: Record<string, string> }> {
  const spInstance = sp as SPInstance;

  const result = await spInstance.parseLoginResponse(idp, 'post', { body });

  const { extract } = result;

  // Extract nameId — samlify v2 puts it in extract.nameID
  const nameId: string = (extract.nameID as string | undefined) ?? (extract.nameid as string | undefined) ?? '';

  // Flatten attributes — samlify stores them as Record<string, unknown>
  const rawAttrs = extract.attributes as Record<string, unknown>;
  const attributes: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawAttrs ?? {})) {
    attributes[k] = Array.isArray(v) ? String((v as unknown[])[0] ?? '') : String(v ?? '');
  }

  // Best-effort email extraction
  const email =
    attributes['email'] ??
    attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ??
    attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn'] ??
    nameId;

  if (!email) throw new Error('SAML assertion does not contain an email attribute');

  return { email, nameId, attributes };
}

// ── SP metadata XML ──────────────────────────────────────────────────────────

interface SPWithMetadata {
  getMetadata: () => string;
}

export function generateSPMetadata(sp: unknown): string {
  return (sp as SPWithMetadata).getMetadata();
}
