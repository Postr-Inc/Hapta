import { tokenManager } from "../utils/jwt.js";

function create(pb, data){
  let {collection, record} = data

}
async function deleteItem(pb, data){
    if(!data.collection) return {error: true, message: 'collection name is required', key: data.key};
    if(!data.token) return {error: true, message: 'client auth token is required', key: data.key};
    try {
        let idFromToken = tokenManager.decode(data.token).id
        if(data.collection === 'users' && idFromToken !== data.id) return {error: true, message: 'You are not authorized to perform this action', key: data.key};
        let res = await pb.admins.client.collection(data.collection).delete(data.id)
        return {error: false, key: data.key, data: res}
    } catch (error) {
        return {error: true, message: error.message, key: data.key}
    }
    
}
async function update(pb, data, collectionModal = {}) {
    if (!data.data || Object.keys(data.data).length === 0) {
      return { error: true, message: 'record data to swapout is required', key: data.key };
    }
    if (!data.collection) {
      return { error: true, message: 'collection name is required', key: data.key };
    }
    if (!data.token) {
      return { error: true, message: 'client auth token is required', key: data.key };
    }
    
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
  
    try {
      let res = await pb.admins.client.collection(data.collection).update(data.id, data.data, {
        filter: data.filter || '',
        sort: data.sort || ''
      });
      return { error: false, key: data.key, data: res };
    } catch (error) {
      return { error: true, message: error.message, key: data.key };
    }
  }
  

async function list(pb, data = {}){
  let  { collection, query, limit, offset, sort, filter} = data.data
   
  
   try {
       
      let res = await pb.admins.client.collection(collection).getList(offset, limit, {
        filter:filter || "",
        sort: sort || ''
     })
     switch(collection){
       case 'users':
        res.items.forEach((item)=>{
            item.emailVisibility === false  ? delete item.email : null
        })
         break;
       default:
         break;
     }
     return {error: false, data: res, key: data.key}
   } catch (error) {
      return {error: true, message: error.message, key: data.key}
   }
   
}
export default async function CrudManager(pb, sendMessage,data, method =  {"create": "create", "read": "read", "update": "update", "delete": "delete"}){
    
  try {
    await pb.admins.authWithPassword(process.env.EMAIL, process.env.PASSWORD)
  } catch (error) {
     global.shouldLog ? console.log(error.message) : null
  }
  if(!tokenManager.isValid(data.token)){
    sendMessage({
        error: true,
        message: 'Invalid token',
        key: data.key
    })
    return;
        
  }
 

  switch(method){
    case "list":
        sendMessage(await list(pb, data))
        break;
    case "create":
        create(pb, data)
        break;
    case "read":
        list(pb, data)
        break;
    case "update":
        sendMessage(await update(pb, data))
        break;
    case "delete":
        deleteItem(pb, data)
        break;
    default:
    break;

  }



 
}