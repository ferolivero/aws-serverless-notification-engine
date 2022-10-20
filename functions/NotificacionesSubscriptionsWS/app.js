const AWS = require("aws-sdk");
const uuid = require("uuid");
const moment = require("moment-timezone");

const createSubscription = async (
  subscriberId,
  connectionId,
  domainName,
  stage
) => {
  const channel = "websocket";
  const topic = "WS";
  return new Promise((resolve, reject) => {
    const sortKey = `${topic}#${channel}`;
    const dynamoDb = new AWS.DynamoDB.DocumentClient();
    let params = {
      TableName: `${process.env.Environment}Subscriptions`,
      Item: {
        subscriberId,
        "topic#channel": sortKey,
        topic: topic,
        subscriptionId: uuid(),
        createdAt: moment().tz('America/Buenos_Aires').format(),
        channel: channel,
        endpoint: connectionId,
        domainName: domainName,
        stage: stage,
        subscriptionArn: false
      },
      ReturnValues: "ALL_OLD"
    };
    dynamoDb.put(params, (err, body) => {
      if (err) {
        console.debug(JSON.stringify(err));
        reject(err);
      } else {
        resolve(body.Attributes);
      }
    });
  });
};

exports.handler = async (event, context) => {
  let response;
  try {
    const body = JSON.parse(event.body);
    const subscriberId = body.message.identity;
    const connectionId = event.requestContext.connectionId;
    const domainName = event.requestContext.domainName;
    const stage = process.env.BasePath;

    try {
      await createSubscription(
        subscriberId,
        connectionId,
        domainName,
        stage
      );
    } catch (error) {
      throw error;
    }
    
    response = {
      statusCode: 200,
      headers: { 
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({}),
    };
  } catch (err) {
    console.debug(JSON.stringify(event));
    console.log(err);
    response = {
      statusCode: 400,
      headers: { 
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({}),
    };
  }
  return response;
};
