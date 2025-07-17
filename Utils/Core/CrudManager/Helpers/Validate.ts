 
import { decode } from "hono/jwt"; 
import CacheController from "../../CacheManager";  
import { ErrorCodes, ErrorMessages } from "../../../Enums/Errors";
import { pb , rqHandler} from "../../../../src";

// Define types for validation results and inputs
interface ValidationResult {
    opCode: ErrorCodes;
    _payload?: { message: string };  
    payload?: { message: string };  
    message?: string;  
}

// Ensure payload types are consistent with CrudManager
interface CrudPayload {
     collection: string;
    data?: any; // For create
    id?: string; // For get, update, delete
    expand?: string[];
    invalidateCache?: string[];
    cacheKey: string;
    page?: number; // For list
    limit?: number; // For list
    isEmbed?: boolean; // For get
    options?: {
        order?: "asc" | "desc";
        sort?: string;
        expand?: string[];
        filter?: string;
        recommended?: boolean;
        [key: string]: any; // Allow other options
    };
    fields?: any; // For update
}

/**
 * Validates incoming data for CRUD operations based on method and collection.
 * @param data The payload for the CRUD operation.
 * @param method The CRUD method being performed ("create", "get", "list", "update", "delete").
 * @param decodedId The ID of the authenticated user from the token payload.
 * @param cache The CacheController instance (for looking up existing records).
 * @param skip Optional: if true, validation is skipped.
 * @returns A ValidationResult object if there's an error, otherwise `null` or `undefined`.
 */
export default async function Validate(
    data: any,
    method: string,
    decodedId: string | null, // Explicitly allow null if token is optional/invalid
    cache: CacheController, // Use the correct type
    skip: boolean = false,
    token?: string
): Promise<ValidationResult | null> { // Return null on success
    if (skip) return null; // No error if validation is skipped

    
    let error: ValidationResult | null = null; // Initialize as null

    // For debugging:
    // console.log(`[Validate] Method: ${method}, Decoded ID: ${decodedId}, Data:`, data);

    // Centralized check for required `collection` field (often missing in errors)
    if (!data.collection) {
        return {
            opCode: ErrorCodes.FIELD_MISSING,
            _payload: { message: "Collection name is required" },
            message: ErrorMessages[ErrorCodes.FIELD_MISSING],
        };
    }

    switch (method) {
        case "get":
        case "delete": // Both need an ID
            if (!data.id) {
                error = {
                    opCode: ErrorCodes.FIELD_MISSING,
                    _payload: { message: "Record ID is required" },
                    message: ErrorMessages[ErrorCodes.FIELD_MISSING],
                };
            }
            break;

        case "list":
            // Consolidate list validation checks
            if (!data.limit) {
                error = { opCode: ErrorCodes.FIELD_MISSING, _payload: { message: "Limit is required" } };
            } else if (!data.page) {
                error = { opCode: ErrorCodes.FIELD_MISSING, _payload: { message: "Page is required" } };
            } else if (!data.options) { 
                error = { opCode: ErrorCodes.FIELD_MISSING, _payload: { message: "Options object is required" } };
            }
            break;

        case "create":
            // Specific validation for 'posts' and 'comments'
            if (data.collection === "posts" || data.collection === "comments") {
                if(data.payload){
                    data = data.payload as any;
                }
                if (!decodedId) { // Ensure user is authenticated to create
                     error = {
                        opCode: ErrorCodes.UNAUTHORIZED_REQUEST,
                        _payload: { message: "Authentication required to create this record." }
                    };
                    break;
                } 
                if (data.data?.author !== decodedId) { // Check if author matches authenticated user
                    error = {
                        opCode: ErrorCodes.UNAUTHORIZED_REQUEST,
                        _payload: { message: "Invalid Request: Cannot create a record on behalf of another user." }
                    };
                    break;
                }
                if (!data.data?.author) {
                    error = {
                        opCode: ErrorCodes.FIELD_MISSING,
                        _payload: { message: `${data.collection} missing field: author. Ensure the author field is passed in the data object.` }
                    };
                    break;
                }
                if (!data.data?.content || (typeof data.data.content === 'string' && data.data.content.length < 1)) {
                    error = {
                        opCode: ErrorCodes.FIELD_MISSING,
                        _payload: { message: `${data.collection} missing field: content. Content must not be empty or undefined in the data object.` }
                    };
                    break;
                }
                // Prevent assigning likes/views on creation
                if (data.data?.likes?.length > 0 || data.data?.views?.length > 0) {
                    error = {
                        opCode: ErrorCodes.UNAUTHORIZED_REQUEST,
                        _payload: { message: "You cannot assign likes or views to your posts/comments on creation. This is against policy and may result in account termination!" }
                    };
                    break;
                }
            }
            break;

        case "update":
            if (!data.id) {
                error = {
                    opCode: ErrorCodes.FIELD_MISSING,
                    _payload: { message: "Record ID is required for update" }
                };
                break;
            }
            if (!data.fields || Object.keys(data.fields).length === 0) {
                error = {
                    opCode: ErrorCodes.FIELD_MISSING,
                    _payload: { message: "Fields to update are required and cannot be empty." }
                };
                break;
            }

            // Get the existing record to check ownership/permissions
            // Use rqHandler.crudManager.get for consistent data retrieval and caching
            const existingRecordResponse = await rqHandler.crudManager.get({ id: data.id, collection: data.collection, isEmbed: true, cacheKey: "" }, token as string);
            const existingRecord = existingRecordResponse._payload;

            if (!existingRecord) {
                error = {
                    opCode: ErrorCodes.NOT_FOUND,
                    _payload: { message: `${data.collection} record not found.` }
                };
                break;
            }

            if (!decodedId) { // Ensure user is authenticated to update
                error = {
                    opCode: ErrorCodes.UNAUTHORIZED_REQUEST,
                    _payload: { message: "Authentication required to update this record." }
                };
                break;
            }

            // Centralized authorization logic
            const isOwner = (existingRecord.id === decodedId) || (existingRecord.author === decodedId);

            for (const field of Object.keys(data.fields)) {
                let isAuthorized = true;

                switch (data.collection) {
                    case "users":
                        const canUpdateIfOwnerUser = ["email", "name", "password", "username", "bio", "avatar", "banner", "location", "age", "website"];
                        const canUpdateIfNotOwnerUser = ["followers", "following"]; // Fields others can update

                        if (field === "following" && data.fields[field] === decodedId) { 
                            isAuthorized = false;
                            error = { opCode: ErrorCodes.UNAUTHORIZED_REQUEST, _payload: { message: "Invalid action for 'following' field." } };
                        } else if (isOwner && !canUpdateIfOwnerUser.includes(field)) { 
                        } else if (!isOwner && canUpdateIfOwnerUser.includes(field)) {
                            
                            isAuthorized = false;
                            error = { opCode: ErrorCodes.UNAUTHORIZED_REQUEST, _payload: { message: `You are not authorized to update field '${field}'.` } };
                        } else if (isOwner && canUpdateIfNotOwnerUser.includes(field)) { 
                            isAuthorized = false;
                            error = { opCode: ErrorCodes.UNAUTHORIZED_REQUEST, _payload: { message: `You cannot directly modify field '${field}'.` } };
                        }
                        break;

                    case "posts":
                    case "comments":
                        const canUpdateIfOwnerContent = ["content", "files", "tags", "privacy"]; 
                        if (field === "author" || field === "likes" || field === "views") {
                             isAuthorized = false;
                             error = { opCode: ErrorCodes.UNAUTHORIZED_REQUEST, _payload: { message: `You cannot directly modify field '${field}'.` } };
                             break;
                        }

                        if (!isOwner && canUpdateIfOwnerContent.includes(field)) {
                            isAuthorized = false;
                            error = { opCode: ErrorCodes.UNAUTHORIZED_REQUEST, _payload: { message: `You are not authorized to update field '${field}'.` } };
                        }
                        break;
                }
                if (!isAuthorized) {
                    break; // Exit field loop if unauthorized
                }
            }
            break;

        default:
            
            break;
    }

    // Return the error if one was set, otherwise null (indicating success)
    return error;
}