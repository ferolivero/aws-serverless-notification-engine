let AWS = require('aws-sdk')
let uuid = require('uuid')

let environment
let response

const createSubscription = async (security, subscription, arn, timestamp) => {
    return new Promise((resolve, reject) => {
        const sortKey = `${subscription.topic}#${subscription.channel}#${subscription.endpoint}`
        const dynamoDb = new AWS.DynamoDB.DocumentClient();
        const params = {
            TableName: `${environment}Subscriptions`,
            Item: {
                subscriberId: `${security.tenant}|${security.username}`,
                'topic#channel#endpoint': sortKey,
                topic: subscription.topic,
                subscriptionId: uuid.v4(),
                createdAt: timestamp,
                channel: subscription.channel,
                endpoint: subscription.endpoint,
                filter: subscription.filter,
                subscriptionArn: arn.SubscriptionArn || null,
                platformEndpointArn: arn.EndpointArn || null
            },
            ConditionalExpression: 'attribute_not_exists(topic#channel#endpoint)',
            ReturnValues: 'ALL_OLD'
        };

        dynamoDb.put(params, (err, body) => {
            if (err) {
                console.debug(JSON.stringify(err));
                reject(err);
            } else {
                resolve(body.Attributes);
            }
        });
    })
}

const createSubscriber = (security, timestamp) => {
    return new Promise((resolve, reject) => {

        const dynamoDb = new AWS.DynamoDB.DocumentClient();
        const params = {
            TableName: `${environment}Subscribers`,
            Item: {
                subscriberId: `${security.tenant}|${security.username}`,
                tenantId: security.tenant,
                createdAt: timestamp
            },
            ConditionalExpression: 'attribute_not_exists(subscriberId)',
            ReturnValues: 'ALL_OLD'
        };

        dynamoDb.put(params, (err, body) => {
            console.log('createSubscriber', JSON.stringify(body))

            if (err) {
                console.debug(JSON.stringify(err));
                reject(err);
            } else {
                resolve(body.Attributes);
            }
        });
    });
}

const getTopic = event => {
    return 'arn:aws:sns:us-east-1:215575508054:CIRCUIT_ENGINE_NOTIFICATIONS'
}

const getProtocol = channel => {
    if (channel === 'expo')
        return 'lambda'

    if (channel === 'fcm' || channel === 'apn')
        return 'application'
    return channel
}

const getEndpoint = event => {
    if (event.channel === 'expo')
        return 'arn:aws:lambda:us-east-1:215575508054:function:serverlessrepo-simple-websocke-SendMessageFunction-1SF7VA445JXNB'
    return event.endpoint
}

const createSubscriptionInSNS = async (security, message, endpoint) => {
    return new Promise((resolve, reject) => {
        const params = {
            Protocol: getProtocol(message.channel),
            TopicArn: 'arn:aws:sns:us-east-1:215575508054:app/GCM/HCC_Licencias_Dev',
            Endpoint: message.endpoint,
            ReturnSubscriptionArn: true,
        };
        let sns = new AWS.SNS();

        sns.subscribe(params, function (err, data) {
            console.log('createSubscriptionInSNS', JSON.stringify(data))

            if (err) {
                console.log(err, err.stack);
                reject(err)
            }
            else resolve(data);
        });
    })
}

const createSNSPlatformEndpoint = async message => {
    return new Promise((resolve, reject) => {
        const params = {
            PlatformApplicationArn: 'arn:aws:sns:us-east-1:215575508054:app/GCM/HCC_Licencias_Dev',
            Token: message.endpoint
        };
        let sns = new AWS.SNS();

        sns.createPlatformEndpoint(params, function (err, data) {

            console.log('createSNSPlatformEndpoint', JSON.stringify(data))
            if (err) {
                console.log(err, err.stack);
                reject(err)
            }
            else resolve(data);
        });
    })
}

exports.handler = async (event, context) => {
    try {
        environment = event.stageVariables.Environment
        //console.log(JSON.stringify(event))
        let endpointArn
        const body = JSON.parse(event.body);
        console.log(JSON.stringify(body))
        const timestamp = (new Date()).toISOString()
        const security = JSON.parse(event.requestContext.authorizer.credentials)
        const subscriptor = await createSubscriber(security, timestamp);

        if (['fcm','apn','fcm-expo','apn-expo'].indexOf(body.channel) > -1) {
            endpointArn = await createSNSPlatformEndpoint(body)
        } else {
            endpointArn = await createSubscriptionInSNS(security, body, endpointArn || body.endpoint);
        }
        const subscription = await createSubscription(security, body, endpointArn, timestamp)
        //if subscription is null it means it was just created, otherwise the record will be
        // returned
        response = {
            'statusCode': !subscription ? 201 : 200,
            'body': JSON.stringify({
                subscription_id: subscription.subscriptionId,
            })
        }
    } catch (err) {
        console.log(err);
        return err;
    }

    return response
};
