const AWS = require("aws-sdk");

const getSubscriber = (endpoint) => {
  return new Promise((resolve, reject) => {
    const dynamoDb = new AWS.DynamoDB.DocumentClient();
    const params = {
      TableName: `${process.env.Environment}Subscriptions`,
      IndexName: "endpoint",
      KeyConditionExpression: "endpoint = :endpoint",
      ExpressionAttributeValues: {
        ":endpoint": endpoint
      }
    };

    dynamoDb.query(params, (err, body) => {
      if (err) {
        console.debug(JSON.stringify(err));
        reject(err);
      } else {
        resolve(body);
      }
    });
  });
};

const DeleteSubscriber = (data) => {
  return new Promise((resolve, reject) => {
    const dynamoDb = new AWS.DynamoDB.DocumentClient();
    const params = {
      TableName: `${process.env.Environment}Subscriptions`,
      Key: {
        subscriberId: data.subscriberId,
        'topic#channel': data['topic#channel']
      }
    };

    dynamoDb.delete(params, (err, body) => {
      if (err) {
        console.debug(JSON.stringify(err));
        reject(err);
      } else {
        resolve(body);
      }
    });
  });
};

exports.handler = async (event, context) => {
  let response;
  try {
    const subscriber = await getSubscriber(event.requestContext.connectionId);
    await DeleteSubscriber(subscriber.Items[0]);

    response = {
      headers: { 'Access-Control-Allow-Origin': '*' },
      statusCode: 200,
      body: JSON.stringify({})
    };
  } catch (err) {
    console.debug(JSON.stringify(event));
    console.log(err);
    response = {
      headers: { 'Access-Control-Allow-Origin': '*' },
      statusCode: 500
    };
  }

  return response;
};
