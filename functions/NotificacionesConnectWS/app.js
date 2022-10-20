const AWS = require("aws-sdk");
const moment = require("moment-timezone");

const createSubscription = async (
  subscriberId,
  connectionId,
  domainName,
  stage,
  proceso = null
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
        createdAt: moment().tz('America/Buenos_Aires').format(),
        channel: channel,
        endpoint: connectionId,
        domainName: domainName,
        stage,
        subscriptionArn: false,
      },
      ReturnValues: "ALL_OLD"
    };
    if (proceso) params.Item.proceso = proceso;
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
  console.debug(JSON.stringify(event));
  let response;
  try {
    const identity = event.requestContext.identity;
    const domainName = event.requestContext.domainName;
    const connectionId = event.requestContext.connectionId;
    const authorizer = event.requestContext.authorizer;
    const { App } = event.queryStringParameters;
    
    // En caso de que sea un usuario temporal
    if (identity.cognitoAuthenticationType === 'unauthenticated') {
      try {
        const stage = process.env.BasePath;
        await createSubscription(identity.accessKey, connectionId, domainName, stage);
      } catch (error) {
        throw error;
      }
    } else {
      // crea subscripcion con usuario de AD
      try {
        const stage = process.env.BasePathWithAuth;
        await createSubscription(authorizer.principalId, connectionId, domainName, stage, App);
      } catch (error) {
        throw error;
      }
    }
    
    response = {
      statusCode: 200,
      headers: { 
        "Access-Control-Allow-Origin": "*", 
        "Access-Control-Allow-Credentials": true
      },
      body: JSON.stringify({}),
    };
    
  } catch (err) {
    console.debug(JSON.stringify(event));
    console.log(err);
    response = {
      statusCode: 400,
      headers: { 
        "Access-Control-Allow-Origin": "*", 
        "Access-Control-Allow-Credentials": true 
      },
      body: JSON.stringify({}),
    };
  }
  return response;
};
