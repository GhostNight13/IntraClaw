/**
 * INTRACLAW — Tool Registry
 * Central catalog of all tools with semantic descriptions for retrieval
 */
import { logger } from '../utils/logger';

export interface ToolDoc {
  name: string;
  description: string;
  category: string;
  examples: string[];
  inputs: string[];
  outputs: string;
  envRequired?: string[];
}

export const TOOL_CATALOG: ToolDoc[] = [
  {
    name: 'gmail',
    description: 'Read, send, search Gmail emails. Triage inbox. Generate email digests.',
    category: 'communication',
    examples: ['send email to client', 'read new emails', 'search emails about invoice', 'generate email digest'],
    inputs: ['to', 'subject', 'body', 'searchQuery'],
    outputs: 'email list or sent confirmation',
    envRequired: ['GMAIL_CLIENT_ID'],
  },
  {
    name: 'google-calendar',
    description: 'List, create, delete Google Calendar events. Find free time slots.',
    category: 'scheduling',
    examples: ['list events today', 'create meeting tomorrow at 2pm', 'find free slots this week', 'book appointment'],
    inputs: ['startDate', 'endDate', 'title', 'description'],
    outputs: 'calendar events or free slots',
    envRequired: ['GOOGLE_CALENDAR_CREDENTIALS'],
  },
  {
    name: 'notion',
    description: 'Read/write Notion pages. Manage prospect CRM database. Update properties.',
    category: 'productivity',
    examples: ['add prospect to notion', 'update prospect status', 'read page content', 'create page'],
    inputs: ['pageId', 'properties', 'content'],
    outputs: 'notion page data',
    envRequired: ['NOTION_TOKEN'],
  },
  {
    name: 'web-scraper',
    description: 'Scrape website content. Extract text from URLs. Analyze web pages.',
    category: 'data',
    examples: ['scrape website homepage', 'extract contact from page', 'get company info from URL'],
    inputs: ['url', 'selector'],
    outputs: 'extracted text/html',
  },
  {
    name: 'computer-use',
    description: 'Control Mac desktop. Take screenshots. Click, type, run AppleScript. Open apps.',
    category: 'automation',
    examples: ['take screenshot', 'click on button', 'type text', 'open application', 'run applescript'],
    inputs: ['action', 'coordinates', 'text', 'appName'],
    outputs: 'screenshot or action result',
  },
  {
    name: 'terminal-exec',
    description: 'Execute shell commands. Run scripts. Check system status.',
    category: 'system',
    examples: ['run npm install', 'check disk space', 'list files', 'run python script'],
    inputs: ['command', 'cwd'],
    outputs: 'stdout/stderr',
  },
  {
    name: 'document-generator',
    description: 'Generate PDF, DOCX, PPTX documents. Create reports and presentations.',
    category: 'content',
    examples: ['create PDF report', 'generate DOCX proposal', 'make PowerPoint presentation'],
    inputs: ['format', 'content', 'title'],
    outputs: 'file path to generated document',
  },
  {
    name: 'image-generator',
    description: 'Generate images with AI (FAL AI/Stable Diffusion). Create visuals from text prompts.',
    category: 'media',
    examples: ['generate logo image', 'create banner for website', 'make illustration'],
    inputs: ['prompt', 'style', 'size'],
    outputs: 'image URL or base64',
    envRequired: ['FAL_KEY'],
  },
  {
    name: 'video-generator',
    description: 'Generate short videos from text prompts using Replicate AI.',
    category: 'media',
    examples: ['generate product demo video', 'create animated clip'],
    inputs: ['prompt', 'numFrames', 'fps'],
    outputs: 'video URL',
    envRequired: ['REPLICATE_API_TOKEN'],
  },
  {
    name: 'tts',
    description: 'Convert text to speech audio. Generate voiceovers with ElevenLabs or OpenAI.',
    category: 'media',
    examples: ['generate voiceover', 'convert text to audio', 'create podcast intro'],
    inputs: ['text', 'voice', 'speed'],
    outputs: 'audio file path',
  },
  {
    name: 'smart-home',
    description: 'Control Home Assistant devices. Toggle lights, thermostats, switches.',
    category: 'iot',
    examples: ['turn off lights', 'set thermostat to 20', 'lock front door', 'check device status'],
    inputs: ['entityId', 'action', 'value'],
    outputs: 'device state',
    envRequired: ['HA_URL', 'HA_TOKEN'],
  },
  {
    name: 'vision-analyzer',
    description: 'Analyze images with Claude vision. Extract text from images, describe screenshots, identify objects.',
    category: 'ai',
    examples: ['analyze screenshot', 'extract text from image', 'describe photo', 'read document scan'],
    inputs: ['imageBase64', 'mediaType', 'prompt'],
    outputs: 'image description and extracted text',
  },
  {
    name: 'code-runner',
    description: 'Execute Node.js or shell code in sandbox. Write and test code snippets.',
    category: 'development',
    examples: ['run javascript code', 'execute bash script', 'test npm package', 'run calculation'],
    inputs: ['code', 'lang'],
    outputs: 'stdout/stderr/exitCode',
  },
  {
    name: 'graph-memory',
    description: 'Store and query knowledge graph. Create entities and relationships between people, companies, projects.',
    category: 'memory',
    examples: ['remember company info', 'link person to company', 'find related entities', 'build knowledge graph'],
    inputs: ['entityType', 'name', 'properties', 'relationships'],
    outputs: 'entity graph data',
  },
  {
    name: 'vector-memory',
    description: 'Semantic memory search using ChromaDB embeddings. Store and retrieve memories by similarity.',
    category: 'memory',
    examples: ['remember this conversation', 'find similar past interactions', 'search memory', 'store insight'],
    inputs: ['text', 'category', 'searchQuery'],
    outputs: 'relevant memory entries',
  },
  {
    name: 'workflow-runner',
    description: 'Trigger and manage visual workflows built in ReactFlow. Automate multi-step processes.',
    category: 'automation',
    examples: ['run workflow', 'trigger automation', 'execute multi-step process'],
    inputs: ['workflowId', 'variables'],
    outputs: 'workflow run result',
  },
  {
    name: 'cold-email',
    description: 'Generate personalized cold outreach emails for B2B prospecting.',
    category: 'sales',
    examples: ['write cold email to startup CEO', 'create follow-up email', 'generate prospecting email'],
    inputs: ['prospect', 'industry', 'painPoint'],
    outputs: 'email subject and body',
  },
  {
    name: 'pagespeed',
    description: 'Analyze website performance with Google PageSpeed Insights. Get SEO and performance scores.',
    category: 'analytics',
    examples: ['check website speed', 'audit site performance', 'get SEO score for URL'],
    inputs: ['url'],
    outputs: 'performance scores and recommendations',
  },
];

export function getAllTools(): ToolDoc[] {
  return TOOL_CATALOG;
}

export function getToolByName(name: string): ToolDoc | undefined {
  return TOOL_CATALOG.find(t => t.name === name);
}

export function getToolsByCategory(category: string): ToolDoc[] {
  return TOOL_CATALOG.filter(t => t.category === category);
}

// Suppress unused import warning — logger may be used in future expansions
void logger;
