'use strict';

class ExampleWeatherPlugin {
  constructor() {
    this.id          = 'example-weather';
    this.name        = 'Example Weather Plugin';
    this.version     = '1.0.0';
    this.description = 'Example plugin — replace with real plugin code';
  }

  async onLoad(ctx) {
    ctx.registerTool('get_example_data', async (args) => {
      return { message: 'Hello from Example Weather Plugin!', args };
    });
    ctx.logger.info('Example plugin loaded successfully');
  }

  async onUnload() {
    // cleanup
  }
}

module.exports = { default: ExampleWeatherPlugin };
