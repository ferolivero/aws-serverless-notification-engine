let AWS = require('aws-sdk');
const ConfigNotfoundError = require('../errors').ConfigNotfoundError;
const ConfigSource = require('./config_source');

class AzureConfigSource extends ConfigSource {
    constructor(configId) {
        super();
        this.configId = configId;
    }

    async init() {
        let params = {
            TableName: process.env.TABLE_CONFIG,
            Key: {
                configId: this.configId,
                currentStatus: 'ACTIVE'
            }
        };
        return new Promise((resolve, reject) => {
            const docClient = new AWS.DynamoDB.DocumentClient();
            //const docClient =  new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });
            console.debug('params to dynamo: ', params);
            docClient.get(params, (err, data) => {
                if (err || data === {}) {
                    console.error('Unable to read config from dynamo. Error JSON: ', err);
                    throw new ConfigNotfoundError({
                        'ERR_CODE': 'CONFIG_DYNAMO_NOT_FOUND_ERROR',
                        'ERR_TYPE': 'SECURITY',
                        'ERR_MESSAGE':JSON.stringify(err)
                    });

                } else {
                    this.auth = data.Item;
                    resolve(data.Item);
                }
            });
        });
    }
}

module.exports = AzureConfigSource;
