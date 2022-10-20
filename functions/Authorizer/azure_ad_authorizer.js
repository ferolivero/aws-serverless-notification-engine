const request = require('request-promise');
const jwkToPem = require('jwk-to-pem');
let jwt = require('jsonwebtoken');
const CustomError = require('./errors').CustomError;
const IdentityTokenExpiredError = require('./errors').IdentityTokenExpiredError;

class UnableToDownloadJWKSError extends CustomError {}

class UnableToDownloadOpenIdConfigError extends CustomError {}

class UnableToGetGroupsFromAzureADError extends CustomError {}

class UnableToGetAzureADAccessTokenError extends CustomError {}

class IdentityTokenInvalidIssuerError extends CustomError {}

class IdentityTokenInvalidAudienceError extends CustomError {}

class IdentityTokenInvalidKidError extends CustomError {}

class IdentityTokenError extends CustomError {}


// A base class is defined using the new reserved 'class' keyword
class AzureADAuthorizer {
    constructor(decodedToken, token, configSource) {
        console.debug('[param] configSource: ', configSource);
        this.decodedJwt = decodedToken;
        this.token = token;
        if (configSource) {
            this.domain = configSource.getAzureAdDomain();
            this.appId = configSource.getAzureAdAppId();
            this.clientSecret = configSource.getAzureAdClientSecret();
        } else {
            this.domain = process.env.AZURE_AD_DOMAIN;
            console.info('AZURE DOMAIN: '+process.env.AZURE_AD_DOMAIN);
            this.appId = process.env.AZURE_AD_APP_ID;
            console.info('AZURE APP_ID: '+process.env.AZURE_AD_APP_ID);
            this.clientSecret = process.env.CLIENT_SECRET;
        }
    }

    async getIssuer() {
        try {
            const issuer = 'https://login.microsoftonline.com/' + this.domain + '/v2.0/.well-known/openid-configuration';
            return await request(issuer, {json: true});
        } catch (err) {
            console.error('unable to download openid-configuration ', err);
            throw new UnableToDownloadOpenIdConfigError({
                'ERR_CODE': 'UNABLE_TO_DOWNLOAD_OPENID_CONFIGURATION',
                'ERR_TYPE': 'SECURITY',
                'ERR_MESSAGE': err
            });
        }
    }

    async _getKeys(iss) {
        try {
            const response = await request(iss.jwks_uri, {json: true});
            const pems = {};
            const ksd = response.keys;
            for (let i = 0; i < ksd.length; i++) {
                pems[ksd[i].kid] = {
                    pem: jwkToPem({
                        kty: ksd[i].kty,
                        n: ksd[i].n,
                        e: ksd[i].e
                    })
                };
            }
            return pems;
        } catch (error) {
            console.error('unable to download jwks ', error);
            throw new UnableToDownloadJWKSError({
                'ERR_CODE': 'UNABLE_TO_DOWNLOAD_JWKS',
                'ERR_TYPE': 'SECURITY',
                'ERR_MESSAGE': error
            });
        }
    }

    async _getIdentity(token) {
        try {
            const options = {
                headers: {
                    Authorization: 'Bearer ' + token,
                },
                json: true
            };
            const response = await request('https://graph.microsoft.com/v1.0/me/memberOf', options);
            const roles = [];
            for (const role of response.value){
                if (role.securityEnabled)
                    roles.push(role.displayName);
            }
            return {
                userId: this.decodedJwt.payload.unique_name,
                roles: roles
            };
        } catch (err) {
            console.error('unable to download groups ', err);
            throw new UnableToGetGroupsFromAzureADError({
                'ERR_CODE': 'UNABLE_TO_GET_GROUPS_FROM_AZURE_AD',
                'ERR_TYPE': 'SECURITY',
                'ERR_MESSAGE': err
            });
        }
    }

    // async _getAccessToken() {
    //     const form = {
    //         grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    //         client_id: this.appId,
    //         client_secret: this.clientSecret,
    //         assertion: this.token,
    //         scope: 'https://graph.microsoft.com/Group.Read.All',
    //         requested_token_use: 'on_behalf_of'
    //     };
    //     const url = 'https://login.microsoftonline.com/' + this.domain + '/oauth2/v2.0/token';
    //     const options = {
    //         url: url,
    //         headers: {
    //             'Content-Type': 'application/x-www-form-urlencoded'
    //         },
    //         form: form,
    //         json: true
    //     };
    //
    //     try {
    //         const response = await request.post(options);
    //         return response.access_token;
    //     } catch (err) {
    //         console.error("unable to download jwks " + err);
    //         throw new UnableToGetAzureADAccessTokenError({
    //             'ERR_CODE': 'UNABLE_TO_GET_AZURE_AD_ACCESS_TOKEN',
    //             'ERR_TYPE': 'SECURITY',
    //             'ERR_MESSAGE': err
    //         })
    //     }
    // };

    async validateIdentity() {
        try {
            const iss = await this.getIssuer();
            const pems = await this._getKeys(iss);

            //Fail if token is not from your UserPool
            if (this.decodedJwt.payload.iss.split('/')[3] !== iss.issuer.split('/')[3]) {
                throw new IdentityTokenInvalidIssuerError({
                    'ERR_CODE': 'IDENTITY_TOKEN_INVALID_ISSUER',
                    'ERR_TYPE': 'SECURITY',
                    'ERR_MESSAGE': 'Issuer ' + this.decodedJwt.payload.iss + ' is not valid'
                });
            }

            // //Reject the jwt if it's not an 'Access Token'
            if (this.decodedJwt.payload.appid !== this.appId && this.decodedJwt.payload.aud !== 'https://graph.microsoft.com' ) {
                throw new IdentityTokenInvalidAudienceError({
                    'ERR_CODE': 'IDENTITY_TOKEN_INVALID_AUDIENCE',
                    'ERR_TYPE': 'SECURITY',
                    'ERR_MESSAGE': 'Audience ' + this.decodedJwt.payload.appid + ' is not valid'
                });
            }

            //Get the kid from the token and retrieve corresponding PEM
            const kid = this.decodedJwt.header.kid;
            const pem = pems[kid] ? pems[kid].pem : null;
            if (!pem) {
                throw new IdentityTokenInvalidKidError({
                    'ERR_CODE': 'IDENTITY_TOKEN_INVALID_KID',
                    'ERR_TYPE': 'SECURITY',
                    'ERR_MESSAGE': 'Kid ' + kid + ' is not valid'
                });
            }

            //Verify the signature of the JWT token to ensure it's really coming from your User Pool
            // return await jwt.verify(this.token, pem, {issuer: iss.issuer, algorithms: ["RS256"]},
            //     async (err, payload) => {
            //         if (err) {
            //             if (err.name === "TokenExpiredError") {
            //                 console.log("token expired " + err);
            //                 throw new IdentityTokenExpiredError({
            //                     'ERR_CODE': 'IDENTITY_TOKEN_EXPIRED',
            //                     'ERR_TYPE': 'SECURITY',
            //                     'ERR_MESSAGE': err
            //                 });
            //             } else {
            //                 console.error("unauthorized " + err);
            //                 throw new IdentityTokenError({
            //                     'ERR_CODE': 'IDENTITY_TOKEN_UNKNOWN_ERROR',
            //                     'ERR_TYPE': 'SECURITY',
            //                     'ERR_MESSAGE': err
            //                 })
            //             }
            //         } else {
            //             //const accessToken = await this._getAccessToken();
            //             //this.accessToken = accessToken;
            //             return await this._getIdentity(this.token);
            //         }
            //     });
            return await this._getIdentity(this.token);
        } catch (err) {
            console.error(err);
            throw err;
        }
    }
}

module.exports = AzureADAuthorizer;
