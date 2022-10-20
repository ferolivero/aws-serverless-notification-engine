const moment = require('moment-timezone');
const jwt = require('jsonwebtoken');
const base64url = require('base64url');
const AzureADAuthorizer = require('./azure_ad_authorizer');
const ConfigSourcesFactory = require('./config_sources/config_sources_factory');

const CustomError = require('./errors').CustomError;

class InvalidJWTError extends CustomError {}
class UnknownAuthorizer extends CustomError {}
const errors = require('./errors');

const decodeToken = (token) => {
  //Fail if the token is not jwt

  var decodedJwt = jwt.decode(token, {
    complete: true,
  });

  if (!decodedJwt) {
    // Trata de decodificarlo como un JWT de KMS
    // Verifica que tenga 3 secciones
    var token_sections = token.split('.');
    if (token_sections.length == 3) {
      // Convierte la firma del jwt a base64url para poder decodicarlo con la librería jsonwebtoken
      var token_section3_base64url = base64url(token_sections[2]);
      var token_base64url =
        token_sections[0] +
        '.' +
        token_sections[1] +
        '.' +
        token_section3_base64url;
      // Intenta decodificar con la firma ya convertida
      decodedJwt = jwt.decode(token_base64url, {
        complete: true,
      });
    }
  }

  if (!decodedJwt) {
    console.debug('Invalid JWT token value: ', token);
    throw new InvalidJWTError({
      ERR_CODE: 'INVALID_JWT_TOKEN',
      ERR_TYPE: 'SECURITY',
      ERR_MESSAGE: 'Identity token is not valid',
    });
  } else {
    console.info('token decoded OK');
    return decodedJwt;
  }
};

const getAuthenticator = async (token) => {
  let authenticator = null;
  try {
    const decodedToken = decodeToken(token);
    const iss = decodedToken.payload.iss;

    if (
      iss.indexOf('login.microsoftonline.com') > -1 ||
      iss.indexOf('sts.windows.net') > -1
    ) {
      const configSource = await ConfigSourcesFactory.getConfigSource(
        decodedToken.payload.appid,
        ConfigSourcesFactory.getMicrosoftIssuerId()
      );
      authenticator = new AzureADAuthorizer(decodedToken, token, configSource);
    } else {
      console.error('Cannot identify authorizer');
      throw new UnknownAuthorizer({
        ERR_CODE: 'UNKNOWN_AUTHORIZER',
        ERR_TYPE: 'SECURITY',
        ERR_MESSAGE: 'Cannot identify authorizer',
      });
    }
  } catch (err) {
    throw new errors.UnknowError({
      ERR_CODE: 'UNKNOWED_ERROR',
      ERR_TYPE: 'UNKNOWED',
      ERR_MESSAGE: JSON.stringify(err.toString()),
    });
  }
  return authenticator;
};

const generatePolicy = function (principalId, effect, resource) {
  const authResponse = {};
  authResponse.principalId = principalId;
  if (effect && resource) {
    const policyDocument = {};
    policyDocument.Version = '2012-10-17';
    policyDocument.Statement = [];
    const statementOne = {};
    statementOne.Action = 'execute-api:Invoke';
    statementOne.Effect = effect;
    statementOne.Resource = resource;
    policyDocument.Statement[0] = statementOne;
    authResponse.policyDocument = policyDocument;
  }
  return authResponse;
};

exports.handler = async (event, context, callback) => {
  try {
    const token = event.queryStringParameters.Authorization;
    if (!token)
      throw { code: 'Unauthorized', message: 'Not authorized' };
    const authenticator = await getAuthenticator(token);
    const validatedIdentity = await authenticator.validateIdentity();
    console.debug('ValidateIdentity ', validatedIdentity)
    // la idea es que progresivamente podamos unificar los errores a que devuelvan null
    // el validateIdentity y poder aislar las respectivas responsabilidades
    if (!validatedIdentity) throw new Error(`El token: ${token} es inválido`);
    // Valida que el token no esté expirado
    let expired_token = false;
    if (validatedIdentity.hasOwnProperty('expiration_date_utc')) {
      let currenttime_utc_epoch = moment.utc().valueOf();
      let expiration_date_utc_epoch = moment(validatedIdentity.expiration_date_utc, 'YYYY/MM/DDTHH:mm:ssZZ').valueOf();
      if (currenttime_utc_epoch > expiration_date_utc_epoch) {
        expired_token = true;
      }
    }
    if (!expired_token) {
      validatedIdentity.username = validatedIdentity.userId.toLowerCase();
      const resourceArn = event.methodArn;
      const policy = generatePolicy(
        validatedIdentity.username,
        'Allow',
        resourceArn
      );
      console.debug('policy ', JSON.stringify(policy))
      callback(null, policy);
    } else {
      throw { code: 'Unauthorized', message: 'Not authorized' };
    }
  } catch (error) {
    console.log('event: ', JSON.stringify(event));
    console.log(error);
    callback(error.code);
  }
};
