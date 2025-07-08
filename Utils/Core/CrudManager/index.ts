import { decode } from "hono/jwt";
import CacheController from "../CacheManager";
import Pocketbase from "pocketbase";
import Validate from "./Helpers/Validate";
import { extractHashtags, generateHashtext } from "../Ai";
import { Tasks } from "../Concurrency/Enums/Tasks";
import { ErrorCodes, ErrorMessages } from "../../Enums/Errors";
import { HttpCodes } from "../../Enums/HttpCodes";
import { c } from "../../../src";
import RecommendationAlgorithmHandler from "../RecommendationAlgorithmHandler";
import { WebSocket } from "bun";

interface CrudPayload {
    /**
     * The name of the collection to operate on.
     */
    collection: string;
    /**
     * The data to create or update.
     */
    data?: any; // For create
    id?: string; // For get, update, delete
    expand?: string[];
    /**
     * List of cache keys to invalidate after the operation.
     */
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

// Define the shape of a file from your `handleFiles` input
interface FileData {
    data: number[]; // Array of numbers representing Uint8Array
    name?: string;
    type?: string;
}

// Define the expected structure for responses
interface CrudResponse<T = any> {
    _payload: T | T[] | null; // The main payload, can be a single record or an array
    opCode: HttpCodes | ErrorCodes;
    message?: string;
    totalItems?: number;
    totalPages?: number;
}
interface PaginatedRecords<T> {
    id: string;
    collectionId: string;
    collectionName: string;
    [key: string]: any; // Other fields
}

// Define the shape of a Pocketbase record, adjust as needed
interface PocketbaseRecord {
    id: string;
    collectionId: string;
    collectionName: string;
    created: string;
    updated: string;
    expand?: Record<string, any>; // Expanded relations
    [key: string]: any; // Other fields
}

const createQueue = new Map();
const updateQueue = new Map();
const deleteQueue = new Map();

// Extend globalThis to include a typed 'listeners' property
declare global {
    // eslint-disable-next-line no-var
    var listeners: [{ ws: WebSocket }]
}

/**
 * Joins an array of expand strings for Pocketbase, handling special cases.
 * @param expand Array of expand strings.
 * @param collection The collection name.
 * @param method The CRUD method (e.g., "list", "create").
 * @returns A comma-separated string for Pocketbase expand option.
 */
function joinExpand(expand: string[] | undefined, collection: string, method: string): string | undefined {
    if (!expand || expand.length === 0) return undefined;

    return expand
        .filter(e => {
            // Filter out specific expand paths if conditions are met
            if (collection === "users" && method === "list" && e === "developer_account") {
                return false; // Exclude developer_account for user list requests
            }
            return true;
        })
        .join(","); // Use join directly as Pocketbase expects comma-separated
}

/**
 * Converts raw file data (Uint8Array-like) into File objects.
 * Handles both single file and array of files.
 * @param data The file data, either a single FileData object or an array of FileData.
 * @returns An array of File objects.
 */
function handleFiles(data: FileData | FileData[]): File[] {
    const files: File[] = [];

    const processFile = (fileData: FileData) => {
        if (!fileData || !fileData.data) return; // Skip invalid file data

        const array = new Uint8Array(fileData.data);
        const blob = new Blob([array]);
        const name = fileData.name || `${Math.random().toString(36).substring(7)}${Date.now().toString(36)}`;
        const type = fileData.type || "application/octet-stream";

        files.push(new File([blob], name, { type }));
    };

    if (Array.isArray(data)) {
        data.forEach(processFile);
    } else {
        processFile(data);
    }
    return files;
}

export default class CrudManager<T = any> {
    private cache: CacheController;
    private pb: Pocketbase;

    constructor(cache: CacheController, pb: Pocketbase) {
        this.cache = cache;
        this.pb = pb;
    }

    /**
     * Creates a new record in Pocketbase and updates relevant caches.
     * @param payload Data for creation.
     * @param token User authentication token.
     * @returns CrudResponse with created record or error.
     */
    public async create(payload: CrudPayload, token: string): Promise<CrudResponse> {
        // Decode token once and pass it
        let decodedId: string | null = null;
        try {
            decodedId = decode(token).payload.id as string;
        } catch (e) {
            console.warn("Invalid token provided for create operation.");
            // Optionally, return an unauthorized error if a valid token is mandatory for ALL creates
            // For now, continue as Validate will handle specific auth checks
        }

        // Validate input data early. Pass decodedId.
        const hasIssue = await Validate(payload, "create", decodedId, this.cache, false, token);
        if (hasIssue) {
            return { _payload: null, ...hasIssue };
        }

        try {
            // Handle files in data if any
            if (payload.data?.files) {
                if (Array.isArray(payload.data.files) && payload.data.files[0] instanceof File) {
                    // Already native File objects — do nothing
                } else {
                    // JSON `{ data: [...] }` format — call handleFiles
                    payload.data.files = handleFiles(payload.data.files);
                }
            }


            // Create record in Pocketbase
            // Ensure payload.expand is handled correctly (pass undefined if empty)
            const expandOption = joinExpand(payload.expand, payload.collection, "create");
            const res: PocketbaseRecord = await this.pb.admins.client.collection(payload.collection).create(payload.data, {
                ...(expandOption && { expand: expandOption }),
            });

            // Invalidate cache keys matching prefixes if needed
            if (payload.invalidateCache?.length) {
                this.cache.invalidateCacheByNormalizedKeys(payload.invalidateCache, true);
            }

            // Special logic for posts collection
            if (payload.collection === "posts") {
                // 1. Generate and update hashtags
                // Consider batching hashtag creation and post update for performance
                const hashTags = extractHashtags(res.content || "");

                const createdHashtagIds: string[] = [];
                // Use Promise.all for concurrent hashtag creation
                await Promise.all(hashTags.map(async (tag: string) => {
                    try {
                        const existingHashtag = await this.pb.collection("Hashtags").getFirstListItem(`name="${tag}"`, { expand: "posts" });
                        // this should continue because it will throw a 404 if not found
                        createdHashtagIds.push(existingHashtag.id);
                    } catch (error: any) {
                        if (error.status === 404) {
                            // Create new hashtag if it doesn't exist
                            console.log(`Creating new hashtag: ${tag}`);
                            const newHashtag = await this.pb.collection("Hashtags").create({ name: tag, posts: [res.id] });
                            createdHashtagIds.push(newHashtag.id);
                        } else {
                            console.error(`Error fetching or creating hashtag ${tag}:`, error);
                        }
                    }
                }));

                if (createdHashtagIds.length > 0) {
                    // Update the post with the created hashtag IDs
                    await this.pb.collection("posts").update(res.id, { hashtags: createdHashtagIds });
                }



                for (const key of this.cache.keys()) {
                    if (key.includes("feed")) {
                        const cacheData = this.cache.get(key);
                        if (cacheData && cacheData._payload && Array.isArray(cacheData._payload)) {
                            // Prepend the *newly created* record, potentially with expand.
                            // Ensure 'res' has all necessary fields expected by feed display.
                            cacheData._payload = [res, ...cacheData._payload];
                            // Re-set with an appropriate TTL. Your existing logic uses 1 hour.
                            this.cache.set(key, cacheData, Date.now() + 3600 * 1000);
                        }
                    }
                }

                globalThis.listeners?.forEach(async (listener: { ws: WebSocket }) => {
                    let rank = await new RecommendationAlgorithmHandler({
                        _payload: [res as any],
                        totalItems: 1,
                        totalPages: 1,
                        token,
                        userId: decodedId as string
                    }).process(null)
                    // rank post so that it can be displayed in recommendations feed
                    if (rank.items[0].rank > 1 && res.collectionName !== "comments") {
                        listener.ws.send(JSON.stringify({
                            status: HttpCodes.OK,
                            message: "Action completed successfully.",
                            data: {
                                type: "post_created",
                                action: "create",
                                targetId: res.id,
                                collection: payload.collection,
                                userId: decodedId,
                                res: res,
                            },
                        }));
                    }
                });
            }

            return { _payload: res, opCode: HttpCodes.OK, message: "Record created successfully" };
        } catch (error: any) { // Catch more specific error types if possible
            console.error("Error creating record:", error);
            // Pocketbase errors often have a `data` field with more details
            const message = error.data?.message || ErrorMessages[ErrorCodes.SYSTEM_ERROR];
            return {
                _payload: null,
                opCode: ErrorCodes.SYSTEM_ERROR, // Or more specific Pocketbase error code if mapped
                message: message,
            };
        }
    }


    /**
     * Invalidate cache entries by normalized matching keys.
     * Delegates to the CacheController's `invalidateCacheByNormalizedKeys` method.
     * @param targetKeys string[] - raw keys or partial keys to match against normalized cache keys
     * @param verbose boolean - optional console logging
     */
    public invalidateCacheBYMatch(targetKeys: string[], verbose: boolean = false): void {
        this.cache.invalidateCacheByNormalizedKeys(targetKeys, verbose);
    }


    public async saveChanges(): Promise<void> {
        const allKeys = [
            ...createQueue.keys(),
            ...updateQueue.keys(),
            ...deleteQueue.keys(),
        ];
        const results = await Promise.allSettled(allKeys.map(async (key) => {
            console.log(`Rolling queue for ${key}`);
            await (global as any).rollQueue(key, this.pb);
        }));

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`Error rolling queue for ${allKeys[index]}:`, result.reason);
            }
        });
        // Clear queues after successful (or attempted) processing
        createQueue.clear();
        updateQueue.clear();
        deleteQueue.clear();
    }

    /**
     * Retrieves a list of records from Pocketbase, with pagination and caching.
     * Significantly optimized by using Pocketbase's `getList` method.
     * @param payload List parameters.
     * @param token User authentication token.
     * @returns CrudResponse with paginated records or error.
     */
    public async list(payload: CrudPayload, token: string): Promise<CrudResponse<PaginatedRecords<T>>> {
        let decodedId: string | null = null;
        try {
            decodedId = decode(token).payload.id as string;
        } catch {
            console.warn("Invalid token provided in list, proceeding as guest.");
        }

        // Sort options to create a consistent cache key
        const stableOptions = {
            filter: payload.options?.filter || "",
            sort: payload.options?.sort || "",
            expand: payload.options?.expand ? [...payload.options.expand].sort().join(",") : "",
            order: payload.options?.order || "",
            recommended: payload.options?.recommended || false,
            page: payload.page,
            limit: payload.limit
        };

        const cacheKey = payload.cacheKey || `${payload.collection}_list_${JSON.stringify(stableOptions)}`; 
        let cacheStatus = this.cache.timesVisited.get(cacheKey) ?? { incremental: 0, cacheType: "six_hour_immediate" };
        cacheStatus.incremental++;
        this.cache.timesVisited.set(cacheKey, cacheStatus);

        let expirationTime: number;
        if (cacheStatus.incremental > 5) {
            const minMinutes = 15, maxMinutes = 45;
            expirationTime = Date.now() + (Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes) * 60 * 1000;
        } else if (cacheStatus.incremental > 0) {
            const minHours = 1, maxHours = 5;
            expirationTime = Date.now() + (Math.floor(Math.random() * (maxHours - minHours + 1)) + minHours) * 60 * 60 * 1000;
        } else {
            expirationTime = Date.now() + 6 * 60 * 60 * 1000;
        }

        const cachedResponse = this.cache.get(cacheKey);
        if (cachedResponse) {
            if (cachedResponse.expirationTime < expirationTime) {
                this.cache.set(cacheKey, { ...cachedResponse, expirationTime });
                console.log(`Extended cache expiration for key: ${cacheKey}`);
            }
            return {
                opCode: HttpCodes.OK,
                _payload: cachedResponse._payload,
                totalItems: cachedResponse.totalItems,
                totalPages: cachedResponse.totalPages,
            };
        }

        console.log(`Cache miss for key: ${cacheKey}. Fetching data...`);

        const hasIssue = await Validate(payload, "list", decodedId, this.cache, false, token as any);
        if (hasIssue) return { _payload: null, ...hasIssue, message: hasIssue.message || "Validation failed for list request." };

        try {
            const sortString = payload.options?.sort || (payload.options?.order === "asc" ? "created" : "-created");
            const pbExpandOption = joinExpand(payload.options?.expand, payload.collection, "list");

            const pbResponse = await this.pb.admins.client.collection(payload.collection).getList(payload.page!, payload.limit!, {
                sort: sortString,
                filter: payload.options?.filter,
                ...(pbExpandOption && { expand: pbExpandOption }),
                cache: "force-cache",
            }) as any;

            let data = pbResponse.items as PocketbaseRecord[];

            data = await c.run(Tasks.FILTER_THROUGH_LIST, {
                list: data,
                collection: payload.collection,
            });

            if (
                payload.options?.sort?.includes("-pinned") &&
                payload.collection === "posts" &&
                data.length > 0
            ) {
                const pinned = data
                    .filter(post => post.pinned)
                    .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

                const unpinned = data
                    .filter(post => !post.pinned) 

                data = [...pinned, ...unpinned];
            }


            // Cache the response with the calculated expiration time
            this.cache.set(cacheKey, {
                _payload: data,
                expirationTime, // Store the expiration time in the cached object
                totalItems: pbResponse.totalItems,
                totalPages: pbResponse.totalPages,
            }, expirationTime);

            return {
                opCode: HttpCodes.OK,
                _payload: data,
                totalItems: pbResponse.totalItems,
                totalPages: pbResponse.totalPages,
            };
        } catch (error: any) {
            console.error("Error listing records:", error);
            const message = error.data?.message || ErrorMessages[ErrorCodes.SYSTEM_ERROR];
            return {
                _payload: null,
                opCode: ErrorCodes.SYSTEM_ERROR,
                message: message,
            };
        }
    }

    /**
     * Retrieves a single record from Pocketbase by ID, with caching.
     * @param payload Get parameters.
     * @param token User authentication token.
     * @returns CrudResponse with the record or error.
     */
    public async get<U = T>(payload: CrudPayload, token: string): Promise<CrudResponse<U>> {
        let decodedId: string | null = null;
        try {
            decodedId = decode(token).payload.id as string;
        } catch {
            console.warn("Invalid token provided for get operation, proceeding as guest for cache key.");
        }

        // Compose cacheKey using CacheController's buildCacheKey for consistency
        const baseCacheKey = `${payload.collection}_${payload.id}_get_${JSON.stringify(payload.options || {})}`;
        const cacheKey = payload.cacheKey || this.cache.buildCacheKey(baseCacheKey, decodedId || "guest");

        // Cache frequency management (copied from list, consider abstracting this)
        let cacheStatus = this.cache.timesVisited.get(cacheKey) ?? { incremental: 0, cacheType: "six_hour_immediate" };
        cacheStatus.incremental++;
        this.cache.timesVisited.set(cacheKey, cacheStatus);

        let expirationTime: number;
        if (cacheStatus.incremental > 5) {
            const minMinutes = 15, maxMinutes = 45;
            expirationTime = Date.now() + (Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes) * 60 * 1000;
        } else if (cacheStatus.incremental > 0) {
            const minHours = 1, maxHours = 5;
            expirationTime = Date.now() + (Math.floor(Math.random() * (maxHours - minHours + 1)) + minHours) * 60 * 60 * 1000;
        } else {
            expirationTime = Date.now() + 6 * 60 * 60 * 1000;
        }

        // Try cache hit *before* validation and PB call
        const cachedData = this.cache.get(cacheKey);
        if (cachedData && cachedData.expirationTime > Date.now()) {
            if (cachedData.expirationTime < expirationTime) {
                this.cache.set(cacheKey, { ...cachedData, expirationTime });
                console.log(`Extended cache expiration for key: ${cacheKey}`);
            }
            return { opCode: HttpCodes.OK, _payload: cachedData._payload };
        }

        console.log(`Cache miss for key: ${cacheKey}. Fetching data...`);

        // Validate only if not an embed (as per your original logic)
        if (!payload.isEmbed) {
            const hasIssue = await Validate(payload, "get", decodedId, this.cache, false, token); // Pass decodedId
            if (hasIssue) {
                console.warn("Validation failed for get request:", hasIssue);
                return { _payload: null, ...hasIssue };
            }
        }

        try {
            const pbExpandOption = joinExpand(payload.options?.expand, payload.collection, "get");
            const data: PocketbaseRecord = await this.pb.admins.client.collection(payload.collection).getOne(payload.id!, {
                ...(pbExpandOption && { expand: pbExpandOption }),
                cache: "force-cache", // Leverage Pocketbase's internal cache
            });

            const processed = await c.run(Tasks.FILTER_THROUGH_LIST, {
                list: [data],
                collection: payload.collection,
            });

            // Cache the result with the calculated expiration time
            this.cache.set(cacheKey, {
                _payload: processed[0],
                expirationTime, // Store the expiration time in the cached object
            }, expirationTime);


            return { _payload: processed[0], opCode: HttpCodes.OK };
        } catch (error: any) {
            console.error("Error getting record:", error);
            // Handle Pocketbase 404 (not found) specifically
            if (error.status === 404) {
                return {
                    _payload: null,
                    opCode: ErrorCodes.NOT_FOUND,
                    message: ErrorMessages[ErrorCodes.NOT_FOUND], // Ensure you have this mapping
                };
            }
            const message = error.data?.message || ErrorMessages[ErrorCodes.SYSTEM_ERROR];
            return {
                _payload: null,
                opCode: ErrorCodes.SYSTEM_ERROR,
                message: message,
            };
        }
    }

    /**
     * Deletes a record from Pocketbase and updates relevant caches.
     * @param payload Deletion parameters.
     * @param token User authentication token.
     * @returns CrudResponse indicating success or error.
     */
    public async delete(payload: CrudPayload, token: string): Promise<CrudResponse> {
        let decodedId: string | null = null;
        try {
            decodedId = decode(token).payload.id as string;
        } catch {
            console.warn("Invalid token provided for delete operation.");
        }

        // Validate early, passing decodedId
        const hasIssue = await Validate(payload, "delete", decodedId, this.cache, false, token);
        if (hasIssue) return { _payload: null, ...hasIssue };

        try {
            for (const key of this.cache.keys()) {
                const cacheData = this.cache.get(key);
                // Check if it's a list with _payload array, and if the item is present
                if (cacheData?._payload && Array.isArray(cacheData._payload) && cacheData._payload.some((item: any) => item.id === payload.id)) {
                    // Filter out the deleted item
                    cacheData._payload = cacheData._payload.filter((item: any) => item.id !== payload.id);
                    // Re-set the updated array. Consider if TTL should be maintained or reset.
                    this.cache.set(key, cacheData, Date.now() + 3600 * 1000); // 1 hour cache, consistent with your original
                }
                // Also explicitly delete individual cached items if they exist
                if (key.includes(`${payload.collection}_${payload.id}_get`)) {
                    this.cache.delete(key);
                }
            }

            await this.pb.admins.client.collection(payload.collection).delete(payload.id!);

            if (payload.invalidateCache?.length) {
                this.invalidateCacheBYMatch(payload.invalidateCache, true); // Add verbose for debugging
            }

            return { _payload: null, opCode: HttpCodes.OK, message: "Record deleted successfully" };
        } catch (error: any) {
            console.error("Error deleting record:", error);
            const message = error.data?.message || ErrorMessages[ErrorCodes.SYSTEM_ERROR];
            return {
                _payload: null,
                opCode: ErrorCodes.SYSTEM_ERROR,
                message: message,
            };
        }
    }

    /**
     * Updates a record in Pocketbase and propagates changes to the cache.
     * @param payload Update parameters.
     * @param token User authentication token.
     * @param skipValidate Optional: skip validation if true.
     * @returns CrudResponse with updated record or error.
     */
    public async update(payload: CrudPayload, token: string, skipValidate: boolean = false): Promise<CrudResponse> {
        let decodedId: string | null = null;
        try {
            decodedId = decode(token).payload.id as string;
        } catch {
            console.warn("Invalid token provided for update operation.");
        }

        // Validate input, passing decodedId
        const hasIssue = await Validate(payload, "update", decodedId, this.cache, skipValidate, token);
        if (hasIssue) return { _payload: null, ...hasIssue };

        try {
            // Handle files in fields if any
            if (payload.fields) {
                for (const key in payload.fields) {
                    // Check for a specific `isFile` property on the field value
                    if (payload.fields[key] && typeof payload.fields[key] === 'object' && payload.fields[key].isFile) {
                        const files = handleFiles(payload.fields[key]);
                        // Assuming only one file expected per field marked as `isFile`
                        payload.fields[key] = files.length > 0 ? files[0] : undefined;
                    }
                }
            }

            // Perform the update in Pocketbase
            const expandOption = joinExpand(payload.expand, payload.collection, "update");
            const res: PocketbaseRecord = await this.pb.collection(payload.collection).update(payload.id!, payload.fields, {
                ...(expandOption && { expand: expandOption }),
            });

            // Invalidate specific cache keys if provided.
            // This uses the CacheController's method.
            if (payload.invalidateCache?.length) {
                this.invalidateCacheBYMatch(payload.invalidateCache, true);
            }

            // Propagate changes to all relevant cached entries using CacheController's update mechanism
            // The `fields: res` means the entire updated record is merged.
            this.cache.updateAllOccurrences(payload.collection, {
                id: res.id,
                fields: res, // Pass the full updated record for merging
            });

            return { _payload: res, opCode: HttpCodes.OK, message: "Record updated successfully" };
        } catch (error: any) {
            console.error("Error updating record:", error);
            const message = error.data?.message || ErrorMessages[ErrorCodes.SYSTEM_ERROR];
            return {
                _payload: null,
                opCode: ErrorCodes.SYSTEM_ERROR,
                message: message,
            };
        }
    }
}
