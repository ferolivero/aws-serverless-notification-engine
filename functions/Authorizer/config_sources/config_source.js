class ConfigSource {
    constructor(event){

    }

    getAzureAdDomain(){
        return this.auth.azure_ad_domain;
    }

    getAzureAdAppId(){
        return this.auth.azure_ad_app_id;
    }

    getAzureAdClientSecret(){
        return this.auth.client_secret
    }

    getCognitoPoolId(){
        return this.auth.cognitoPoolId
    }

    getCognitoIdpUrl(){
        return this.auth.cognitoIdpUrl
    }

    getnaranjaCertsKmsKeyArn(){
        return this.auth.naranjaCertsKmsKeyArn
    }

    getnaranjaCertsIssuer() {
        return this.auth.naranjaCertsIssuer
    }
}

module.exports = ConfigSource;
