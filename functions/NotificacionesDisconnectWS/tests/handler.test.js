'use strict';

let app = require('../app.js');
const chai = require('chai');
const expect = chai.expect;
const fs = require('fs')
const path = require('path')
let AWS = require('aws-sdk-mock');
let AWS_SDK = require('aws-sdk');
AWS.setSDKInstance(AWS_SDK);

let event, context;

describe('Tests index', function () {

    beforeEach((done) => {
        AWS.restore();
        process.env.AWS_DEFAULT_REGION = 'us-east-1'
        process.env.AWS_REGION = 'us-east-1'
        done();
    })
    it('verifies successful response', async function () {
        this.timeout(20000);

        const event = JSON.parse(fs.readFileSync(path.normalize(__dirname + '/mock/event.json')).toString());

        // AWS.mock('SNS', 'subscribe', function (params, callback) {
        //     callback(null, {
        //         ResponseMetadata: { 
        //             RequestId: 'd9306d5d-ec06-52c8-9805-385536f95142' 
        //         },
        //         SubscriptionArn: 'arn:aws:sns:us-east-1:215575508054:CIRCUIT_ENGINE_NOTIFICATIONS:ccf54eef-929f-4151-8623-9eec69ac1875'
        //     });
        // });

        // AWS.mock('DynamoDB.DocumentClient', 'create', function (params, callback) {
        //     callback(null, sampleTaskDefinition);
        // });

        // AWS.mock('DynamoDB.DocumentClient', 'put', function (params, callback) {
        //     task = params;
        //     callback(null, sampleTask);
        // });

        const result = await app.handler(event, context)
        expect(result.statusCode).to.equal(200);
        let response = JSON.parse(result.body);
        expect(response.subscription_id).to.be.equal("931a023a-0cb9-425f-baea-eb00b2f35e22");
        // expect(response.location).to.be.an("string");
    });
});
