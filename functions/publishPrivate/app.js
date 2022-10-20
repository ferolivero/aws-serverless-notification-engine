let AWS = require('aws-sdk');
let uuid = require('uuid');
const moment = require('moment-timezone');
moment.tz.setDefault('America/Buenos_Aires');

const getSubscriptionsByProceso = async (proceso) => {
  const dynamoDb = new AWS.DynamoDB.DocumentClient();
  return new Promise((resolve, reject) => {
    const params = {
      TableName: `${process.env.Environment}Subscriptions`,
      IndexName: 'procesoIndex',
      KeyConditionExpression: 'proceso = :proceso',
      ExpressionAttributeValues: {
        ':proceso': proceso,
      },
    };
    dynamoDb.query(params, (err, body) => {
      if (err) {
        console.debug(JSON.stringify(err));
        reject(err);
      } else {
        resolve(body.Items);
      }
    });
  });
};

const createNotification = async (
  body,
  messageId,
  showNotification = false
) => {
  return new Promise((resolve, reject) => {
    const dynamoDb = new AWS.DynamoDB.DocumentClient();
    const sortKey = `${body.topic}#${body.subject}`;
    const expirationTime = moment().add(10, 'days').valueOf();
    const item = {
      messageId: messageId,
      'topic#proceso': sortKey,
      publisherId: body.subject,
      subscriberId: body.subscriber,
      cretedAt: new Date().toISOString(),
      topic: body.topic,
      showNotification,
      message: JSON.stringify(body.message),
      currentStatus: 'CREATED',
      expirationTime,
    };
    const params = {
      TableName: `${process.env.Environment}PushMessages`,
      Item: item,
      ReturnValues: 'NONE',
    };

    dynamoDb.put(params, (err, body) => {
      if (err) {
        reject(err);
      } else {
        resolve(item);
      }
    });
  });
};

const publishToPlatformWebsocket = async (subscriptions, body) => {
  return new Promise((resolve, reject) => {
    const apigwManagementApi = new AWS.ApiGatewayManagementApi({
      apiVersion: '2018-11-29',
      endpoint: `${subscriptions.domainName}/${subscriptions.stage}`,
    });

    const data = {
      message: body.message,
      action: body.action || 'default',
    };

    const params = {
      ConnectionId: subscriptions.endpoint,
      Data: JSON.stringify(data),
    };

    apigwManagementApi.postToConnection(params, async function (err, data) {
      if (err) {
        if (err.statusCode === 410) {
          console.log('Found stale connection, deleting ' + body.connectionId);
          reject({
            code: 'FAILED_WS',
            message: 'Found stale connection',
          });
        } else {
          console.log('Failed to post. Error: ' + JSON.stringify(err));
          reject({
            code: 'FAILED_WS',
            message: 'Failed to post.',
          });
        }
      }
      resolve(data);
    });
  });
};

const updateNotification = async (messageId, body) => {
  const dynamoDb = new AWS.DynamoDB.DocumentClient();
  return new Promise((resolve, reject) => {
    const sortKey = `${body.topic}#${body.subject}`;
    const timestamp = new Date().toISOString();
    const params = {
      TableName: `${process.env.Environment}PushMessages`,
      Key: {
        'topic#proceso': sortKey,
        messageId: messageId,
      },
      UpdateExpression:
        'set #currentStatus=:currentStatus, #publisherTimestamp=:publisherTimestamp',
      ExpressionAttributeNames: {
        '#currentStatus': 'currentStatus',
        '#publisherTimestamp': 'publisherTimestamp',
      },
      ExpressionAttributeValues: {
        ':currentStatus': 'PUBLISHED',
        ':publisherTimestamp': timestamp,
      },
      ReturnValues: 'ALL_NEW',
    };
    dynamoDb.update(params, (err, body) => {
      if (err) {
        console.debug(JSON.stringify(err));
        reject(err);
      } else {
        resolve(body.Attributes);
      }
    });
  });
};

exports.handler = async (event) => {
  let response;
  try {
    const detail = event.detail;
    const { proceso } = detail;
    
    const subscriptions = await getSubscriptionsByProceso(proceso);
    
    if (subscriptions.length > 0) {
      for (let subscription of subscriptions) {
        const messageId = uuid.v4();
        const body = {
          topic: 'WS',
          subscriber: subscription.subscriberId,
          message: {
            data: detail
          },
          subject: proceso,
        };
        await createNotification(body, messageId);
        await publishToPlatformWebsocket(subscription, body);
        await updateNotification(messageId, body);
      }
    } else {
      throw {
        code: 'NOT_USER_WS',
        message: 'Topic has not been implemented',
      };
    }
    
    response = {};
  } catch (err) {
    console.debug(JSON.stringify(event));
    console.log(err);
    response = {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      statusCode: 500,
      body: JSON.stringify('Ocurrio un error'),
    };
  }

  return response;
};
