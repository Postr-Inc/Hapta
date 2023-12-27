/**
 * @apiDefine ErrorCodes
 * @apiVersion 1.0.0
 */
export enum ErrorCodes {
    /**
     *  
     * @errorMessage {GENERAL} An unknown error occurred
     */
    GENERAL = 0,
    /**
     * @errorMessage {INVALID_TOKEN} No token provided or invalid token
     */
    INVALID_TOKEN = 1,
    /**
     * @errorMessage {USER_NOT_FOUND} User not found
     */
    USER_NOT_FOUND = 100,
    /**
     * @errorMessage {INVALID_FILTER} Invalid filter
     */
    INVALID_FILTER = 101,
    /**
     * @errorMessage {INVALID_QUERY} Invalid query
     */
    INVALID_QUERY = 102,
    /**
     *  @errorMessage {INVALID_REQUEST} Invalid request
     */
    INVALID_REQUEST = 103,
    /**
     *  
     * @errorMessage {OWNERSHIP_REQUIRED} Invalid Ownership of requested resource you are not permitted to modify/access this resource
     */
    OWNERSHIP_REQUIRED = 104,
    /**
     * @errorMessage {USER_ALREADY_EXISTS} User already exists
     */
    USER_ALREADY_EXISTS = 105,
    /**
     * @errorMessage {USER_NOT_AUTHORIZED} User not authorized
     */
    USER_NOT_AUTHORIZED = 106,
    /**
     * @errorMessage {AUTHENTICATION_FAILED} Authentication failed
     */
    AUTHENTICATION_FAILED = 200, 
    /**
     * @errorMessage {AUTHKEYGENERATION_FAILED} Issue assigning signing key to user
     */
    AUTHKEYGENERATION_FAILED = 201,
    /**
     * @errorMessage {AUTHORIZATION_FAILED} Authorization failed
     */
    AUTHORIZATION_FAILED = 300, 
    /**
     * @errorMessage {DATABASE_ERROR} Database error
     */
    DATABASE_ERROR = 400, 
    /**
     * @errorMessage {UPDATE_FAILED} Failed to update record
     */
    UPDATE_FAILED = 401,
    /**
     * @errorMessage {CREATE_FAILED} Failed to create record
     */
    CREATE_FAILED = 402,
    /**
     * @errorMessage {DELETE_FAILED} Failed to delete record
     */
    DELETE_FAILED = 403, 
    /**
     * @errorMessage {READ_FAILED} Failed to read record
     */
    READ_FAILED = 404,
    /**
     * @errorMessage {VALIDATION_FAILED} Validation failed
     */
    VALIDATION_FAILED = 500, 
    /**
     * @errorMessage {RATE_LIMITED} Rate limited
     */
    RATE_LIMITED = 600, 
    /**
     * @errorMessage {INTERNAL_ERROR} Internal error
     */
    INTERNAL_ERROR = 900,
    /**
     * @errorMessage {TRIED_TO_ACCESS_AUTHSTATE} You do not have permission to view auth based collections
     */
    TRIED_TO_ACCESS_AUTHSTATE = 901,
    /**
     * @errorMessage {FIELD_MISSING} Required field missing
     */
    FIELD_MISSING = 1000,
    /**
     * @errorMessage {TYPEOF_EXPAND_NOT_ARRAY} Expand must be an array
     */
    TYPEOF_EXPAND_NOT_ARRAY = 1001,
    /**
     * @errorMessage {TYPEOF_RETURNABLES_NOT_ARRAY} Returnable must be an array
     */
    TYPEOF_RETURNABLES_NOT_ARRAY = 1002,
    /**
     * @errorMessage {Type Mismatch} Type Mismatch
     */
    TYPE_MISMATCH = 1003,
    /**
     * @errorMessage {TYPEOF_FILTER_NOT_STRING} Filter must be a string
     */
    TYPEOF_FILTER_NOT_STRING = 1004,
    /**
     * @errorMessage {MISSING_AUTH_STATE_RECORDS} Missing auth state records
     */
    MISSING_AUTH_STATE_RECORDS = 1005,
    /**
     * @errorMessage {FAILED_ADMIN_AUTH} Failed to authenticate as admin
     */
    FAILED_ADMIN_AUTH = 1006,
    /**
     * @errorMessage {INVALID_FILE_TYPE} Invalid file type
     */
    INVALID_FILE_TYPE = 1007,
}

let ErrorMessages  = {
    [ErrorCodes.GENERAL]: "An unknown error occurred",
    [ErrorCodes.INVALID_REQUEST]: "The request sent was invalid",
    [ErrorCodes.INVALID_TOKEN]: "No token provided or invalid token",
    [ErrorCodes.USER_NOT_FOUND]: "User not found",
    [ErrorCodes.INVALID_FILTER]: "Invalid filter",
    [ErrorCodes.OWNERSHIP_REQUIRED]: "Invalid Ownership of requested resource you are not permitted to modify/access this resource",
    [ErrorCodes.AUTHENTICATION_FAILED]: "Authentication failed",
    [ErrorCodes.AUTHORIZATION_FAILED]: "Authorization failed",
    [ErrorCodes.AUTHKEYGENERATION_FAILED]: "Issue assigning signing key to user",
    [ErrorCodes.DATABASE_ERROR]: "Database error",
    [ErrorCodes.CREATE_FAILED]: "Failed to create record",
    [ErrorCodes.UPDATE_FAILED]: "Failed to update record",
    [ErrorCodes.DELETE_FAILED]: "Failed to delete record",
    [ErrorCodes.READ_FAILED]: "Failed to read requested record id",
    [ErrorCodes.VALIDATION_FAILED]: "Validation failed",
    [ErrorCodes.RATE_LIMITED]: "Rate limited",
    [ErrorCodes.INTERNAL_ERROR]: "Internal error",
    [ErrorCodes.TRIED_TO_ACCESS_AUTHSTATE]: "You do not have permission to view auth based collections",
    [ErrorCodes.FIELD_MISSING]: "Required field missing",
    [ErrorCodes.TYPEOF_EXPAND_NOT_ARRAY]: "Expand must be an array",
    [ErrorCodes.TYPEOF_RETURNABLES_NOT_ARRAY]: "Returnable must be an array",
    [ErrorCodes.TYPE_MISMATCH]: "Expected type does not match actual type",
    [ErrorCodes.TYPEOF_FILTER_NOT_STRING]: "Filter must be a string",
    [ErrorCodes.MISSING_AUTH_STATE_RECORDS]: "Please create authState and devAuthState collections in your database",
    [ErrorCodes.FAILED_ADMIN_AUTH]: "Failed to authenticate as admin",
    [ErrorCodes.INVALID_FILE_TYPE]: "File given is not a valid file type"

}
/**
 * @apiDefine ErrorMessages
 * @class ErrorMessages
 * @description  Handles Errors and returns a formatted error message
 */
export class ErrorHandler {
     msgData: any;
     constructor(msgData: any) {
       this.msgData = msgData;
        
     }

     public handle(error: any) {
        let code = error.code || ErrorCodes.GENERAL;
        // @ts-ignore
        let message =   ErrorMessages[code] as any || error.message || ErrorMessages[ErrorCodes.GENERAL]
        return  {error: true,  type: this.msgData.type || null,  message: message, code: code}
     }  
}