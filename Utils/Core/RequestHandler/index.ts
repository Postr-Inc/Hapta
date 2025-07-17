import { WSContext } from "hono/ws"; 
import CrudManager from "../CrudManager";
import RecommendationAlgorithmHandler from "../RecommendationAlgorithmHandler";  
import { cache, pb } from "../../../src";
import { MessageTypes } from "../../Enums/MessageTypes";
import { decode } from "hono/jwt";
 
interface CrudResult {
    _payload?: any;
    payload: any;
    opCode: number;
    totalItems?: number;
    totalPages?: number;
}
 
interface IncomingMessageData {
    type: MessageTypes;
    callback: string;
    payload: any;  
    ws?: WSContext;  
}

export default class RequestHandler {
    crudManager: CrudManager;

    constructor() { 
        this.crudManager = new CrudManager(cache, pb);
    }

    /**
     * Handles incoming messages for CRUD and recommendation operations.
     * @param data The incoming message data containing type, callback, payload, and optionally WebSocket context.
     * @param token The authentication token.
     * @returns A promise that resolves to the operation result.
     */
    async handleMessage(data: IncomingMessageData, token: string): Promise<CrudResult> {
        const { type, payload } = data; // 'callback' and 'ws' are destructured but not used within this method

        switch (type) {
            case MessageTypes.LIST: {
                if (payload.options?.recommended) {
                    // Handle recommended content logic
                    const listResult = await this.crudManager.list(payload, token) as CrudResult;

                    if (listResult.opCode !== 200) {
                        return { opCode: listResult.opCode, _payload: listResult._payload, payload: listResult._payload };
                    }

                    // Ensure `_payload` is an array for recommendation processing
                    if (!Array.isArray(listResult._payload)) {
                        console.warn("Recommendation handler received non-array payload. Check CrudManager.list implementation.");
                        return { opCode: 500, _payload: { message: "Internal server error: Invalid data for recommendation." }, payload: { message: "Internal server error: Invalid data for recommendation." } };
                    }

                    const recommendedHandler = new RecommendationAlgorithmHandler({
                        _payload: listResult._payload,
                        totalPages: payload.limit, // This might be `payload.options.limit` or calculated differently
                        totalItems: listResult.totalItems ?? 0,
                        userId: decode(token).payload.id as string,
                        token: token // Pass the token for any necessary authorization in RecommendationAlgorithmHandler
                    });

                    const metrics = await recommendedHandler.initUserMetrics()

                    const { items: recommended, totalItems, totalPages } = await recommendedHandler.process(metrics);

                    return {
                        opCode: 200,
                        payload: recommended, // Renamed to _payload for consistency
                        totalItems: totalItems,
                        totalPages: totalPages
                    };
                }

                // Standard list operation
                const listResult = await this.crudManager.list(payload, token) as CrudResult;
                return {
                    opCode: listResult.opCode,
                    payload: listResult._payload,
                    totalItems: listResult.totalItems,
                    totalPages: listResult.totalPages
                };
            }

            // Centralized function for other CRUD operations to reduce repetition
            case MessageTypes.DELETE:
            case MessageTypes.UPDATE:
            case MessageTypes.GET:
            case MessageTypes.CREATE: {
                let operationPromise: Promise<any>;
                switch (type) {
                    case MessageTypes.DELETE:
                        operationPromise = this.crudManager.delete(payload, token);
                        break;
                    case MessageTypes.UPDATE:
                        operationPromise = this.crudManager.update(payload, token);
                        break;
                    case MessageTypes.GET:
                        operationPromise = this.crudManager.get(payload, token);
                        break;
                    case MessageTypes.CREATE:
                        operationPromise = this.crudManager.create(payload, token);
                        break;
                    default:
                        // This case should ideally not be reached if `type` is one of the above
                        return { opCode: 500, _payload: { message: "Internal server error: Unhandled message type." }, payload: { message: "Internal server error: Unhandled message type." } };
                }
                const result = await operationPromise;
                // Normalize the result to always have _payload
                return {
                    opCode: result.opCode,
                    _payload: result._payload !== undefined ? result._payload : result.payload,
                    payload: result._payload !== undefined ? result._payload : result.payload,
                    totalItems: result.totalItems,
                    totalPages: result.totalPages
                };
            }

            case MessageTypes.DEEP_SEARCH:
                // Uncomment and implement when ready, or remove if not needed.
                // const deepSearchResult = await this.crudManager.deepSearch(payload, token) as CrudResult;
                // return { opCode: deepSearchResult.opCode, _payload: deepSearchResult._payload };
                return { opCode: 501, _payload: { message: "Not Implemented: Deep Search" }, payload:{ message: "Not Implemented: Deep Search" } }; // Return appropriate status

            default:
                return { opCode: 400, _payload: { message: "Invalid Message Type" } , payload: { message: "Invalid Message Type" }}; // Changed to 400 Bad Request
        }
    }
}