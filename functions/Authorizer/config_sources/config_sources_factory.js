const microsoftIssuerId = "microsoft";
const AzureConfigSource = require("./azure_config_source");

class ConfigSourcesFactory {
  static getMicrosoftIssuerId() {
    return microsoftIssuerId;
  }

  static async getConfigSource(configId, sourceName) {
    console.debug(`configId: ${configId}   sourceName: ${sourceName}`);
    var source;
    if (sourceName === this.getMicrosoftIssuerId()) {
      source = new AzureConfigSource(configId);
    }
    await source.init();
    return source;
  }
}

module.exports = ConfigSourcesFactory;
