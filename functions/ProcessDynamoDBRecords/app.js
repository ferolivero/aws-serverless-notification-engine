const AWS = require('aws-sdk');
const converter = AWS.DynamoDB.Converter;
const eventBridge = new AWS.EventBridge();

exports.handler = async (event) => {
  try {
    let entries = [];
    for (let record of event.Records) {
      const element = converter.unmarshall(record.dynamodb.NewImage);

      const newEvent = {
        Source: 'tramites.dynamodb',
        EventBusName: process.env.EVENT_BUS_NAME,
        DetailType: 'MOTOR DE TRAMITES',
        Time: new Date(),
        Detail: JSON.stringify({
          idTramite: element.idTramite,
          estado: element.estado,
          proceso: element.proceso,
          numero_documento: element.numero_documento,
          action: record.eventName,
          source: 'MT',
          tipoNotificacion: 'info'
        }),
      };
      entries.push(newEvent);
    }
    const params = {
      Entries: entries,
    };
    const result = await eventBridge.putEvents(params).promise();
    return result;
  } catch (error) {
    console.log('event ', JSON.stringify(event));
    console.error(error);
  }
};
