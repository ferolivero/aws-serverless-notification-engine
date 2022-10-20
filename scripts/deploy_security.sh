#!/bin/bash
if ! which -s sam ; then
  echo "sam not found"
  exit 1
fi

ENV=dev
AWS_PROFILE=naranja-dev-new
SOURCE="$(pwd)/cloudformations"
UUID=$$
BUCKET=$ENV-naranja-base-deploy

STACK=$ENV-SECURITY-MOTOR-DE-NOTIFICACIONES
PROJECT=MOTOR-DE-NOTIFICACIONES

echo 'Building SAM package and uploading cloudformation'
sam package --profile $AWS_PROFILE  --template-file "${SOURCE}/security.yaml" --output-template-file "security_$UUID.yaml" --s3-bucket $BUCKET
sam deploy --profile $AWS_PROFILE  --template-file "security_$UUID.yaml" --stack-name $STACK --tags Project=$PROJECT --capabilities CAPABILITY_NAMED_IAM --parameter-overrides Environment=$ENV Proyecto=$PROJECT
rm "security_$UUID.yaml"
