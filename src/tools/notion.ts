import { Client } from '@notionhq/client';
import type {
  CreatePageParameters,
  UpdatePageParameters,
  QueryDatabaseParameters,
  PageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { logger } from '../utils/logger';
import { ProspectStatus, ContentPlatform } from '../types';
import type { Prospect, ContentPost } from '../types';

// Database IDs
const DB = {
  CRM:     '5231b6a464a541fcb4b879b23f762ccc',  // 📧 CRM Prospects Agence
  CONTENT: '95a61970e38c445c897fd427c031f44e',  // Content posts (à créer si besoin)
  CLIENTS: '04be88317c7e4722a5e1c0831ab58494',  // 💼 Clients & Projets Freelance
} as const;

function getClient(): Client {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) throw new Error('NOTION_API_KEY not set in .env');
  return new Client({ auth: apiKey });
}

// ─── Helper builders ─────────────────────────────────────────────────────────

function title(text: string) {
  return { title: [{ text: { content: text } }] };
}

function richText(text: string) {
  return { rich_text: [{ text: { content: text.slice(0, 2000) } }] };
}

function selectProp(name: string) {
  return { select: { name } };
}

function dateProp(iso: string | undefined) {
  if (!iso) return { date: null };
  return { date: { start: iso } };
}

function emailProp(email: string) {
  return { email };
}

function urlProp(url: string) {
  return { url };
}

function extractText(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as Record<string, unknown>;
  if (Array.isArray(p['title'])) {
    return (p['title'] as Array<{plain_text: string}>)
      .map(t => t.plain_text).join('');
  }
  if (Array.isArray(p['rich_text'])) {
    return (p['rich_text'] as Array<{plain_text: string}>)
      .map(t => t.plain_text).join('');
  }
  if (p['select'] && typeof p['select'] === 'object') {
    return (p['select'] as {name: string}).name ?? '';
  }
  if (typeof p['email'] === 'string') return p['email'];
  if (typeof p['url'] === 'string')   return p['url'];
  if (p['date'] && typeof p['date'] === 'object') {
    return (p['date'] as {start: string}).start ?? '';
  }
  return '';
}

// ─── Prospects / CRM ─────────────────────────────────────────────────────────

export async function addProspect(prospect: Omit<Prospect, 'id' | 'createdAt'>): Promise<string> {
  const notion = getClient();

  const params: CreatePageParameters = {
    parent: { database_id: DB.CRM },
    properties: {
      'Name':          title(prospect.name),
      'Business Name': richText(prospect.businessName),
      'Email':         emailProp(prospect.email),
      'Phone':         richText(prospect.phone ?? ''),
      'Website':       urlProp(prospect.website ?? ''),
      'Industry':      selectProp(prospect.industry),
      'Location':      richText(prospect.location),
      'Status':        selectProp(prospect.status),
      'Source':        richText(prospect.source),
      'Pain Points':   richText(prospect.painPoints.join(', ')),
      'Notes':         richText(prospect.notes),
    },
  };

  const page = await notion.pages.create(params);
  logger.info('Notion', `Prospect added: ${prospect.name}`, { id: page.id });
  return page.id;
}

export async function updateProspectStatus(pageId: string, status: ProspectStatus): Promise<void> {
  const notion = getClient();
  const params: UpdatePageParameters = {
    page_id: pageId,
    properties: {
      'Status': selectProp(status),
      'Last Contacted At': dateProp(new Date().toISOString()),
    },
  };
  await notion.pages.update(params);
  logger.info('Notion', `Prospect status updated: ${pageId} → ${status}`);
}

export async function getProspectsByStatus(status: ProspectStatus): Promise<Prospect[]> {
  const notion = getClient();

  const params: QueryDatabaseParameters = {
    database_id: DB.CRM,
    filter: {
      property: 'Status',
      select: { equals: status },
    },
    sorts: [{ property: 'Name', direction: 'ascending' }],
    page_size: 50,
  };

  const response = await notion.databases.query(params);

  const pages = response.results.filter(
    (p): p is PageObjectResponse => 'properties' in p
  );

  return pages.map((page) => {
    const props = page.properties as Record<string, unknown>;
    return {
      id:               page.id,
      name:             extractText(props['Name']),
      businessName:     extractText(props['Business Name']),
      email:            extractText(props['Email']),
      phone:            extractText(props['Phone']) || undefined,
      website:          extractText(props['Website']) || undefined,
      industry:         extractText(props['Industry']),
      location:         extractText(props['Location']),
      status:           (extractText(props['Status']) as ProspectStatus) || ProspectStatus.NEW,
      source:           extractText(props['Source']),
      painPoints:       extractText(props['Pain Points']).split(', ').filter(Boolean),
      notes:            extractText(props['Notes']),
      createdAt:        extractText(props['Created At']),
      lastContactedAt:  extractText(props['Last Contacted At']) || undefined,
    };
  });
}

export async function findDuplicateProspect(email: string): Promise<boolean> {
  const notion = getClient();
  const response = await notion.databases.query({
    database_id: DB.CRM,
    filter: {
      property: 'Email',
      email: { equals: email },
    },
    page_size: 1,
  });
  return response.results.length > 0;
}

// ─── Content posts ────────────────────────────────────────────────────────────

export async function addContentPost(post: Omit<ContentPost, 'id'>): Promise<string> {
  const notion = getClient();

  const params: CreatePageParameters = {
    parent: { database_id: DB.CONTENT },
    properties: {
      'Hook':           title(post.hook.slice(0, 100)),
      'Body':           richText(post.body),
      'CTA':            richText(post.cta),
      'Platform':       selectProp(post.platform),
      'Hashtags':       richText(post.hashtags.join(' ')),
      'Topic':          richText(post.topic),
      'Generated By':   selectProp(post.generatedBy),
      'Scheduled For':  dateProp(post.scheduledFor),
      'Published At':   dateProp(post.publishedAt),
    },
  };

  const page = await notion.pages.create(params);
  logger.info('Notion', `Content post added: ${post.hook.slice(0, 50)}`, { id: page.id });
  return page.id;
}

export async function getRecentContentTopics(days = 14): Promise<string[]> {
  const notion = getClient();
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

  const response = await notion.databases.query({
    database_id: DB.CONTENT,
    filter: {
      property: 'Scheduled For',
      date: { on_or_after: cutoff },
    },
    page_size: 50,
  });

  return response.results
    .filter((p): p is PageObjectResponse => 'properties' in p)
    .map((page) => {
      const props = page.properties as Record<string, unknown>;
      return extractText(props['Topic']);
    }).filter(Boolean);
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export interface ClientRecord {
  id: string;
  name: string;
  businessName: string;
  email: string;
  website?: string;
  revenue: number;
  convertedAt: string;
  notes: string;
}

export async function addClient(client: Omit<ClientRecord, 'id'>): Promise<string> {
  const notion = getClient();

  const params: CreatePageParameters = {
    parent: { database_id: DB.CLIENTS },
    properties: {
      'Name':          title(client.name),
      'Business Name': richText(client.businessName),
      'Email':         emailProp(client.email),
      'Website':       urlProp(client.website ?? ''),
      'Revenue':       { number: client.revenue },
      'Converted At':  dateProp(client.convertedAt),
      'Notes':         richText(client.notes),
    },
  };

  const page = await notion.pages.create(params);
  logger.info('Notion', `Client added: ${client.name}`, { revenue: client.revenue });
  return page.id;
}

export async function getClients(): Promise<ClientRecord[]> {
  const notion = getClient();
  const response = await notion.databases.query({
    database_id: DB.CLIENTS,
    sorts: [{ property: 'Converted At', direction: 'descending' }],
    page_size: 50,
  });

  const clientPages = response.results.filter(
    (p): p is PageObjectResponse => 'properties' in p
  );
  return clientPages.map((page: PageObjectResponse) => {
    const props = page.properties as Record<string, unknown>;
    const revProp = props['Revenue'] as { number?: number } | undefined;
    return {
      id:           page.id,
      name:         extractText(props['Name']),
      businessName: extractText(props['Business Name']),
      email:        extractText(props['Email']),
      website:      extractText(props['Website']) || undefined,
      revenue:      revProp?.number ?? 0,
      convertedAt:  extractText(props['Converted At']),
      notes:        extractText(props['Notes']),
    };
  });
}
