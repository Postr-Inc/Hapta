import { decode } from "hono/jwt";
import { ErrorCodes } from "../../../Enums/Errors";
import { pb } from "../../../src";

export default async function Validate(data: any, method: string, token?: string, cache?: any) {
    let error = null;
    let decodedId = decode(token as any).payload.id;
    switch (method) {
        case "list":
            if (!data.limit) {
                error = {
                    opCode: ErrorCodes.FIELD_MISSING,
                    _payload: { message: "Limit is required" }
                };
            } else if (!data.collection) {
                error = {
                    opCode: ErrorCodes.FIELD_MISSING,
                    _payload: { message: "Collection is required" }
                };
            } else if (!data.page) {
                error = {
                    opCode: ErrorCodes.FIELD_MISSING,
                    _payload: { message: "Page is required" }
                };
            } else if (!data.options) {
                error = {
                    opCode: ErrorCodes.FIELD_MISSING,
                   _payload: { message: "Options is required" }
                };
            }
            break;
        
        case "update":
            let { id } = data;
            if (!id) {
                error = {
                    opCode: ErrorCodes.FIELD_MISSING,
                    payload: { message: "ID is required" }
                };
                break;
            } 
            

            switch (data.collection) {
                case "users":
                    let canUpdateIfOwner = ["email", "name", "password", "username", "following", "bio", "avatar", "banner", "location", "age", "website"];
                    let canUpdateIfNotOwner = ["followers"];

                    // Check authorization for each field
                    Object.keys(data.fields).forEach((field) => { 
                        if(field == "following" && data.fields[field] == decodedId){
                           error = {
                            opCode: ErrorCodes.UNAUTHORIZED_REQUEST,
                             payload: { message: "You are not authorized to perform this action"}
                           }
                        }
                        else if (id !== decodedId && canUpdateIfOwner.includes(field)) { 
                            error = {
                                opCode: ErrorCodes.UNAUTHORIZED_REQUEST,
                                payload: { message: "You are not authorized to perform this action" }
                            };
                        } else if (id === decodedId && canUpdateIfNotOwner.includes(field)) {
                            error = {
                                opCode: ErrorCodes.UNAUTHORIZED_REQUEST,
                                payload: { message: "You are not authorized to perform this action" }
                            };
                        }
                    });
                    break;

                case "posts":
                    let canUpdateIfOwnerPost = ["content", "files", "tags", "privacy", "author"]; 
                    let post =  await pb.collection("posts").getOne(id, { cache: "force-cache" }); 
                    if (!post) {
                        error = {
                            opCode: ErrorCodes.NOT_FOUND,
                            payload: { message: "Post not found" }
                        };
                        break;
                    }
                    
                    Object.keys(data.fields).forEach((field) => {
                        if (post.author !== decodedId && canUpdateIfOwnerPost.includes(field)) {
                             
                            error = {
                                opCode: ErrorCodes.UNAUTHORIZED_REQUEST,
                                payload: { message: "You are not authorized to perform this action" }
                            };
                        }  
                    }); 
                    break;
                case "comments":
                    let canUpdateIfOwnerComment = ["content", "author", "post"];
                    let comment = cache.get(`comments_${id}`) || await pb.collection("comments").getOne(id, { cache: "force-cache" });
                    cache.set(`comments_${id}`, comment, new Date().getTime() + 3600);
                    if (!comment) {
                        error = {
                            opCode: ErrorCodes.NOT_FOUND,
                            payload: { message: "Comment not found" }
                        };
                        break;
                    }
                    Object.keys(data.fields).forEach((field) => {
                        if (comment.author !== decodedId && canUpdateIfOwnerComment.includes(field)) {
                            error = {
                                opCode: ErrorCodes.UNAUTHORIZED_REQUEST,
                                payload: { message: "You are not authorized to perform this action" }
                            };
                        }
                    });
                    break;
                

                default:
                    break;
            }
            break;

        case "delete":
            if (!data.id) {
                error = {
                    opCode: ErrorCodes.FIELD_MISSING,
                    payload: { message: "ID is required" }
                };
            } else if (!data.collection) {
                error = {
                    opCode: ErrorCodes.FIELD_MISSING,
                    payload: { message: "Collection is required" }
                };
            }
            let _data =  cache.get(`${data.collection}_${data.id}`) || await pb.collection(data.collection).getOne(data.id, { cache: "force-cache" });
            cache.set(`${data.collection}_${data.id}`, _data, new Date().getTime() + 3600);
            if(!_data){
                error = {
                    opCode: ErrorCodes.NOT_FOUND,
                    payload: { message: "Item not found" }
                };
            }

            if (data.collection === "users") {
                let decodedId = decode(token as any).payload.id;
                if (_data.id !== decodedId) {
                    error = {
                        opCode: ErrorCodes.UNAUTHORIZED_REQUEST,
                        payload: { message: "You are not authorized to perform this action" }
                    };
                }
            }else if (data.collection === "posts") {
                let decodedId = decode(token as any).payload.id;
                if (_data.author !== decodedId) {
                    error = {
                        opCode: ErrorCodes.UNAUTHORIZED_REQUEST,
                        payload: { message: "You are not authorized to perform this action" }
                    };
                }
            }


            break;
        default:
            break;
        case "create":
            if(!data.id){
                 error = {
                    opCode: ErrorCodes.FIELD_MISSING,
                    payload: { message: "ID is required" }
                };
            }

           


           switch(data.collection){
                case 'posts':
                case 'comments':
                     if(decodedId != data.author){
                         error = {
                          opCode: ErrorCodes.UNAUTHORIZED_REQUEST,
                          payload: {message: "Invalid Request Cannot create post on behalf of another user"}
                        }
                     }

                     if(!data.author){
                        error = {
                            opCode: ErrorCodes.FIELD_MISSING,
                            payload: {message: "Post missing field - author, ensure the author field is passed in the Object"}
                        }
                     }else if(!data.content || data.content && data.content.length < 1){
                        error = {
                            opCode: ErrorCodes.FIELD_MISSING,
                            payload: {message: "Post missing field - content, content must not be empty or undefined in the Object"}
                        }
                     }
                
 

           }
    }

    return error;
}
