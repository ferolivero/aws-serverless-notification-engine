#!/bin/bash

# VARIABLES ESTANDAR
ENV=dev
AWS_PROFILE=naranja-dev-new
SOURCE="$(pwd)"
UUID=$$
BUCKET=$ENV-naranja-base-deploy

STACK=$ENV-INFRA-MOTOR-DE-NOTIFICACIONES
PROJECT=MOTOR-DE-NOTIFICACIONES

# VARIABLES ESPECIFICAS SEGUN EL MICROSERVICIO

echo 'Validating local SAM Template...'
sam validate --template "$SOURCE/cloudformations/template.yaml" --debug  --profile $AWS_PROFILE 
echo 'Building local SAM App...'
sam build --profile $AWS_PROFILE -t "${SOURCE}/cloudformations/template.yaml"
echo 'Packaing SAM  cloudformation...'
sam package --profile $AWS_PROFILE  --template-file "$SOURCE/.aws-sam/build/template.yaml" --output-template-file "$SOURCE/.aws-sam/build/package.yaml" --s3-bucket $BUCKET
echo 'Building SAM  cloudformation...'
sam deploy --profile $AWS_PROFILE  --template-file "$SOURCE/.aws-sam/build/package.yaml" --stack-name $STACK --tags Project=$PROJECT --capabilities CAPABILITY_NAMED_IAM --parameter-overrides UUID=$UUID Environment=$ENV DeployBucket=$BUCKET StackName=$STACK Proyecto=$PROJECT
