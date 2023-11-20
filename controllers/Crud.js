import { tokenManager } from "../utils/jwt.js";

async function create(pb, data) {
    console.log(data)
    let { collection, token} = data
 
    switch (true) {
        case !collection:
            return { error: true, message: 'collection name is required', key: data.key };
        case !data.data:
            return { error: true, message: 'record data is required', key: data.key };
        case !token:
            return { error: true, message: 'client auth token is required', key: data.key };
        default:
            for(var i in data.data){
                if(data.data[i].isFile){
                    const uint8Array = new Uint8Array(data.data[i].data);
                    const blob = new Blob([uint8Array], { type: data.data[i].type });
                     data.data[i] = blob

                }
            }
            let form = new FormData();
            Object.keys(data.data).forEach((key) => {
                form.append(key, data.data[key])
            })
            try {
                let res = await pb.admins.client.collection(collection).create(form)
                return { error: false, key: data.key, data: res }
            } catch (error) {
                return { error: true, message: error.response, key: data.key }
            }
        

    }
}
async function deleteItem(pb, data) {
    switch (true) {
        case !data.collection:
            return { error: true, message: 'collection name is required', key: data.key };
        case !data.id:
            return { error: true, message: 'record id is required', key: data.key };
        case !data.token:
            return { error: true, message: 'client auth token is required', key: data.key };
        case data.collection === 'users' && tokenManager.decode(data.token).id !== data.id:
            return { error: true, message: 'You are not authorized to perform this action', key: data.key };
        default:
            try {
                await pb.admins.client.collection(data.collection).delete(data.id)
                return { error: false, key: data.key, data: {message: 'success', code:200} }
            } catch (error) {
                return { error: true, message: error.message, key: data.key }
            }
    }

}

async function read(pb, data = {}) {
    switch (true) {
        case !data.collection:
            return { error: true, message: 'collection name is required', key: data.key };
        case !data.id:
            return { error: true, message: 'record id is required', key: data.key };
        case !data.token:
            return { error: true, message: 'client auth token is required', key: data.key };
        case data.returnable && !Array.isArray(data.returnable):
            return { error: true, message: 'returnable must be an array', key: data.key };

        default:
            let idFromToken = tokenManager.decode(data.token).id;
            try {
                let res = await pb.admins.client.collection(data.collection).getOne(data.id)
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
async function update(pb, data = {}, collectionModal = {}) {
  
    switch (true) {
        case !data.data || Object.keys(data.data).length === 0:
            return { error: true, message: 'record data to swapout is required', key: data.key };
        case !data.collection:
            return { error: true, message: 'collection name is required', key: data.key };
        case !data.token:
            return { error: true, message: 'client auth token is required', key: data.key };

        

        default:
            let idFromToken = tokenManager.decode(data.token).id;

            const fieldsToRemove = ['email', 'emailVisibility', 'followers', 'validVerified', 'username', 'password', 'IsPrivate', 'bio', 'deactivated'];



            for (const field of fieldsToRemove) {
                if (idFromToken !== data.id && field !== 'followers') {
                    delete data.data[field];
                    return { error: true, message: `Cannot update ${field} field of another user`, key: data.key };
                }

                if (idFromToken == data.id && (field === 'followers' || field === 'validVerified' || field === 'email')) {
                    delete data.data[field];
                }
            }   
                 
            for(var i in data.data){
                if(data.data[i].isFile){
                    const uint8Array = new Uint8Array(data.data[i].data);
                    const blob = new Blob([uint8Array], { type: data.data[i].type });
                     data.data[i] = blob

                }
            }
            try {

                

                let res = await pb.admins.client.collection(data.collection).update(data.id, data.data, {
                    filter: data.filter || '',
                    sort: data.sort || ''
                });
                return { error: false, key: data.key, data: res };
            } catch (error) {
                return { error: true, message: error.message, key: data.key };
            }
            break;

    }


}


async function list(pb, data = {}) {
    switch (true) {
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

        default:
            let { collection, query, limit, offset, sort, filter } = data.data


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
                            if(data.data.returnable && !data.data.returnable.includes(item.key)){
                                delete res.items[index]
                                
                            }
                        })
                        break;
                }
                return { error: false, data: res, key: data.key }
            } catch (error) {
                return { error: true, message: error.message, key: data.key }
            }
            break;
    }


}
export default async function CrudManager(pb, sendMessage, data, method = { "create": "create", "read": "read", "update": "update", "delete": "delete" }, rules) {
   
    try {
        await pb.admins.authWithPassword(process.env.EMAIL, process.env.PASSWORD)
    } catch (error) {
        global.shouldLog ? console.log(error.message) : null
    }
    if (!tokenManager.isValid(data.token)) {
        sendMessage({
            error: true,
            message: 'Invalid token',
            key: data.key
        })
        return;

    }


    switch (method) {
        case "list":
            sendMessage(await list(pb, data))
            break;
        case "create":
            sendMessage(await create(pb, data))
            break;
        case "read":
            sendMessage(await read(pb, data))
            break;
        case "update":
            sendMessage(await update(pb, data))
            break;
        case "delete":
            sendMessage(await deleteItem(pb, data))
            break;
        default:
            break;

    }
}
