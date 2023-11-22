export class CrudManager{
    constructor(pb, tokenManager){
        this.pb = pb
        this.tokenManager = tokenManager
    }

    async create(data){
         switch (true) {
            case data.collection === 'authState' || data.collection.includes('authState'):
                return { error: true, message:null, key: data.key };
            case !data.collection:
                return { error: true, message: 'collection name is required', key: data.key };
            case !data.record:
                return { error: true, message: 'record data is required', key: data.key };
            case !data.token && data.collection !== 'users'  || !this.tokenManager.isValid(data.token):
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
    async list(data){
         
        switch (true) {
            case data.data.collection === 'authState' || data.data.collection.includes('authState'):
                return { error: true, message: null, key: data.key };
            case !data.data.collection:
                return { error: true, message: 'collection name is required', key: data.key };
            case !data.token:
                return { error: true, message: 'client auth token is required', key: data.key };
            case data.data.limit && typeof data.data.limit !== 'number':
                return { error: true, message: 'limit must be a number', key: data.key };
            case data.data.offset && typeof data.data.offset !== 'number':
                return { error: true, message: 'offset must be a number', key: data.key };
            case data.data.filter && typeof data.data.filter !== 'string':
                return { error: true, message: 'filter must be a string', key: data.key };
            case data.data.sort && typeof data.data.sort !== 'string':
                return { error: true, message: 'sort must be a string', key: data.key };
            case data.data.expand && !Array.isArray(data.data.expand):
                return { error: true, message: 'expand must be an array', key: data.key };
            case data.data.returnable && !Array.isArray(data.data.returnable):
                return { error: true, message: 'returnable must be an array', key: data.key };
            case !await this.tokenManager.isValid(data.token):
                return { error: true, message: 'Invalid token', key: data.key };

            default:
                let { collection, limit, offset, sort, filter } = data.data


            try {

                let res = await pb.admins.client.collection(collection).getList(offset, limit, {
                    filter: filter || "",
                    sort: sort || '',
                    expand: data.data.expand || [],
                })
                 
                switch (collection) {
                    case 'users':
                        res.items.forEach((item) => {
                            item.emailVisibility === false ? delete item.email : null
                            data.data.returnable ? Object.keys(item).forEach((key) => {
                                if (data.data.returnable && !data.data.returnable.includes(key)) delete item[key]
                            }) : null
                        })
                        break;
                    default:
                        res.items.forEach((index, item) => {
                            if(data.data.returnable &&  !data.data.returnable.includes(item.key)){
                                delete res.items[index]
                                
                            }
                        })
                        break;
                }
                return { error: false, data: res, key: data.key }
            } catch (error) {
                return { error: true, message: error.message, key: data.key }
            }
             
        }
    }
    async read(data){
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
                let res = await this.pb.admins.client.collection(data.collection).getOne(data.id)
                data.collection === 'users' && idFromToken !== data.id && res.emailVisibility === false ? delete res.email : null
                Object.keys(res).forEach((key) => {
                    if (data.returnable && !data.returnable.includes(key)) delete res[key]
                })
                return { error: false, key: data.key, data: res }
            } catch (error) {
                console.log(error)
                return { error: true, message: error.message, key: data.key }
            }
        }
    }
    async delete(data){
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
                    return { error: false, key: data.key, data: {message: 'success', code:200} }
                } catch (error) {
                    return { error: true, message: error.message, key: data.key }
                }
        }
    }
}
 