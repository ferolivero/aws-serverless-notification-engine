class CustomError extends Error {
    constructor(error) {
        super();
        this.message = error.ERR_MESSAGE;
        this.detail = error;
        //this.stack = (new Error()).stack;
        this.name = this.constructor.name;
    }
}

class IdentityTokenExpiredError extends CustomError {}
class UserNotfoundError extends CustomError {}
class UnknowError extends CustomError {}
class ConfigNotfoundError extends CustomError {}


module.exports = {
    CustomError: CustomError,
    IdentityTokenExpiredError: IdentityTokenExpiredError,
    UserNotfoundError: UserNotfoundError,
    ConfigNotfoundError: ConfigNotfoundError,
    UnknowError: UnknowError
};
