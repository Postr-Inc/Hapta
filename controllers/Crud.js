import { it } from "node:test";
import events from "events";
export class CrudManager {
    constructor(pb, tokenManager) {
        this.pb = pb
        this.tokenManager = tokenManager
        this.event = new events.EventEmitter()
         
    }

    async create(data) {
        switch (true) {
            case data.collection === 'authState' || data.collection.includes('authState'):
                return { error: true, message: null, key: data.key };
            case !data.collection:
                return { error: true, message: 'collection name is required', key: data.key };
            case !data.record:
                return { error: true, message: 'record data is required', key: data.key };
            case !data.token && data.collection !== 'users' || !this.tokenManager.isValid(data.token):
                return { error: true, message: 'Invalid token', key: data.key };

            default:
                try {
                    let res = await this.pb.admins.client.collection(data.collection).create(data.record)
                    return { error: false, key: data.key, data: res }
                } catch (error) {
                    return { error: true, message: error.message, key: data.key }
                }
        }
    }
    async list(data) {
       
        const { collection, limit, offset, sort, filter, expand, returnable } =  data.data

        if (data.data.collection === 'authState' || data.data.collection.includes('authState')) {
            return { error: true, message: null, key: data.key };
        }

        if (!data.data.collection) {
            return { error: true, message: 'collection name is required', key: data.key };
        }

        if (!data.token) {
            return { error: true, message: 'client auth token is required', key: data.key };
        }

        if (data.data.limit && typeof data.data.limit !== 'number') {
            return { error: true, message: 'limit must be a number', key: data.key };
        }

        if (data.data.offset && typeof data.data.offset !== 'number') {
            return { error: true, message: 'offset must be a number', key: data.key };
        }

        if (data.data.filter && typeof data.data.filter !== 'string') {
            return { error: true, message: 'filter must be a string', key: data.key };
        }

        if (data.data.sort && typeof data.data.sort !== 'string') {
            return { error: true, message: 'sort must be a string', key: data.key };
        }

        if (data.data.expand && !Array.isArray(data.data.expand)) {
            return { error: true, message: 'expand must be an array', key: data.key };
        }

        if (data.data.returnable && !Array.isArray(data.data.returnable)) {
            return { error: true, message: 'returnable must be an array', key: data.key };
        }

        if (!await this.tokenManager.isValid(data.token)) {
            return { error: true, message: 'Invalid token', key: data.key };
        }

        try {
            let res = await pb.admins.client.collection(collection).getList(offset, limit, {
                filter: filter || "",
                sort: sort || '',
                expand: expand || [],
            });

            if (collection === 'users') {
                res.items.forEach((item) => {
                    if (item.emailVisibility === false) delete item.email;
                    if (returnable && Array.isArray(returnable)) {
                        const allowedProperties = new Set(returnable);
                        Object.keys(item).forEach((key) => {
                            if (!allowedProperties.has(key)) {
                                delete item[key];
                            }
                        });
                    }
                });
            } else {
                let newItems = res.items.map((item) => {
                    let newRecord = {
                        id: item.id,
                        expand: {}
                    };

                    if(item.expand && Object.keys(item.expand).length > 0){
                        Object.keys(item.expand).forEach((key) => {
                             Object.keys(item.expand[key]).forEach((key2) => {
                                if (returnable && returnable.includes(key2) && item.expand[key][key2]) {
                                    newRecord.expand[key2] = item.expand[key][key2];
                                }
                                 key2 === 'email' && item.expand[key]['emailVisibility'] === false ? delete item.expand[key]['email'] : null
                                 newRecord.expand[key2] = item.expand[key][key2]
                             })
                        });
                    }

                    Object.keys(item).forEach((key) => {
                        if (returnable && returnable.includes(key)) {
                            newRecord[key] = item[key];
                        }
                        newRecord[key] = item[key];
                    });

                     

                    return newRecord;
                    
                });

                res.items = newItems;

                 
            }
            

            return { error: false, key: data.key, data: res };
        } catch (error) {
            return { error: true, message: error.message, key: data.key };
        }
    }

    async read(data) {
        switch (true) {
            case data.collection === 'authState' || data.collection.includes('authState'):
                return { error: true, message: null, key: data.key };
            case !data.collection:
                return { error: true, message: 'collection name is required', key: data.key };
            case !data.id:
                return { error: true, message: 'record id is required', key: data.key };
            case !data.token:
                return { error: true, message: 'client auth token is required', key: data.key };
            case data.returnable && !Array.isArray(data.returnable):
                return { error: true, message: 'returnable must be an array', key: data.key };
            case !this.tokenManager.isValid(data.token):
                return { error: true, message: 'Invalid token', key: data.key };
            default:
                let idFromToken = this.tokenManager.decode(data.token).id;
                try {
                    let res = await this.pb.admins.client.collection(data.collection).getOne(data.id, {
                        expand: data.expand || [],
                    });

                 
                    // Modify data based on specific conditions
                    if (data.collection === 'users' && idFromToken !== data.id && res.emailVisibility === false) {
                        delete res.email;
                    }

                    // Check for expand and returnable arrays
                    if (data.expand && Array.isArray(data.expand) && (data.returnable && Array.isArray(data.returnable) || data.expand && !data.returnable)) {
                        let newRecord = {
                            id: res.id,
                            expand: {}
                        };

                        // Iterate over each key in res.expand
                        for (let k in res.expand) {
                            Object.keys(res.expand[k]).forEach((key) => {
                                if (data.returnable.includes(key)) {
                                    newRecord.expand[key] = res.expand[k][key];

                                    // Handle specific condition for 'emailVisibility'
                                     
                                    if (

                                       
                                        res.expand[k][key].email &&
                                        res.expand[k][key].emailVisibility === false
                                    ) {
                                        delete newRecord.expand[key].email;
                                    } 
                                }
                            });
                        }

                        // Iterate over each key in res
                        Object.keys(res).forEach((key) => {
                            // Only keep keys that are in the returnable array
                            if (data.returnable.includes(key)) {
                                newRecord[key] = res[key];
                            }
                        });

                        

                        return { error: false, key: data.key, data: newRecord };
                    } else {
                        // If no modifications are needed, return the original item
                        return { error: false, key: data.key, data: res };
                    }
                } catch (error) {
                    global.shouldLog && console.log(error)
                    return { error: true, message: error.message, key: data.key };
                }
        }
    }

    async subscribe(data, sendMessage) {
       
        if(data.records){
            data.records.forEach((record)=>{
                this.event.on(data.eventType, (data)=>{
                    sendMessage({key:data.key, eventType: data.eventType, data: data})
                })
            })
            return;
        }
         this.event.on(data.eventType, (data)=>{
              sendMessage({key:data.key, eventType: data.eventType, data: data})
         })
    }
    async delete(data) {
        switch (true) {
            case data.collection === 'authState' || data.collection.includes('authState'):
                return { error: true, message: null, key: data.key };
            case !data.collection:
                return { error: true, message: 'collection name is required', key: data.key };
            case !data.id:
                return { error: true, message: 'record id is required', key: data.key };
            case !data.token:
                return { error: true, message: 'client auth token is required', key: data.key };
            case data.collection === 'users' && this.tokenManager.decode(data.token).id !== data.id:
                return { error: true, message: 'You are not authorized to perform this action', key: data.key };
            case !this.tokenManager.isValid(data.token):
                return { error: true, message: 'Invalid token', key: data.key };
            default:
                try {
                    await this.pb.admins.client.collection(data.collection).delete(data.id)
                    this.event.emit('delete', {key: data.id, collection: data.collection})
                    return { error: false, key: data.key, data: { message: 'success', code: 200 } }
                } catch (error) {
                    return { error: true, message: error.message, key: data.key }
                }
        }
    }

    async update(data) {
       
        switch(true){
            case data.collection === 'authState' || data.collection.includes('authState'):
                return { error: true, message: null, key: data.key };
            case !data.collection:
                return { error: true, message: 'collection name is required', key: data.key };
            case !data.id:
                return { error: true, message: 'record id is required', key: data.key };
            case !data.token:
                return { error: true, message: 'client auth token is required', key: data.key };
            case data.collection === 'users' && this.tokenManager.decode(data.token).id !== data.id:
                return { error: true, message: 'You are not authorized to perform this action', key: data.key };
            case !this.tokenManager.isValid(data.token):
                return { error: true, message: 'Invalid token', key: data.key };
            default:
                try {
                    
                    let res = await this.pb.admins.client.collection(data.collection).update(data.id, data.data)
                    this.event.emit('update', {key: res.id, collection: data.collection, record: res})
                    return { error: false, key: data.key, data: res }
                } catch (error) {
                    return { error: true, message: error.message, key: data.key }
                }
        }
    }
}

