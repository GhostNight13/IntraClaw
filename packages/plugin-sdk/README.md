# @intraclaw/sdk

SDK for building IntraClaw plugins.

## Installation

```bash
npm install @intraclaw/sdk
```

## Creating a plugin

A plugin is a class implementing `IntraclawPlugin` exported as the default export.

### Minimal example

```typescript
import { IntraclawPlugin, PluginContext } from '@intraclaw/sdk';

class WeatherProPlugin implements IntraclawPlugin {
  id          = 'weather-pro';
  name        = 'Weather Pro';
  version     = '1.0.0';
  description = 'Real-time weather data via Open-Meteo API';

  async onLoad(ctx: PluginContext): Promise<void> {
    // Register a tool the executor can call
    ctx.registerTool('get_weather', async (args: unknown) => {
      const { city } = args as { city: string };
      const cached = await ctx.getMemory(`weather:${city}`);
      if (cached) return JSON.parse(cached);

      const data = await fetch(`https://wttr.in/${city}?format=j1`).then(r => r.json());
      await ctx.setMemory(`weather:${city}`, JSON.stringify(data));
      return data;
    });

    // Register a skill from inline YAML
    ctx.registerSkill(`
id: weather-expert
name: Weather Expert
description: Answers weather questions using real-time data
tools: [get_weather]
`);

    ctx.logger.info('Weather Pro loaded');
  }

  async onUnload(): Promise<void> {
    ctx.logger.info('Weather Pro unloaded');
  }
}

export default WeatherProPlugin;
```

### Directory structure

Place your plugin in `plugins/<plugin-id>/`:

```
plugins/
  weather-pro/
    manifest.json   # plugin metadata
    index.js        # compiled plugin (or index.ts if using ts-node)
```

### manifest.json

```json
{
  "id": "weather-pro",
  "name": "Weather Pro",
  "version": "1.0.0",
  "description": "Real-time weather data"
}
```

## PluginContext API

| Method | Description |
|---|---|
| `registerTool(name, fn)` | Register a callable tool for the executor |
| `registerSkill(yaml)` | Register a YAML skill string |
| `getMemory(key)` | Read from scoped plugin memory |
| `setMemory(key, value)` | Write to scoped plugin memory |
| `notify(message)` | Send a Telegram notification |
| `ask(prompt, opts?)` | Call Claude via IntraClaw (rate-limited) |
| `logger.info/warn/error` | Prefixed logger |

## IntraclawPlugin interface

| Property/Method | Required | Description |
|---|---|---|
| `id` | Yes | Unique plugin identifier |
| `name` | Yes | Human-readable name |
| `version` | Yes | Semver string |
| `description` | Yes | Short description |
| `onLoad(ctx)` | Yes | Called once at startup |
| `onUnload()` | No | Called on graceful shutdown |
| `onMessage(msg)` | No | Intercept incoming messages; return null to drop |

## Notes

- Plugins load from the `plugins/` directory at server root, one subdirectory per plugin.
- Each plugin runs in its own Node.js `require` scope (sandboxed module cache).
- Plugin memory is scoped: key `foo` for plugin `weather-pro` stores as `weather-pro:foo`.
- Rate limits from IntraClaw apply when calling `ctx.ask()`.
