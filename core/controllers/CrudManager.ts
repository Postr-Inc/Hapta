//@ts-nocheck
import { pb } from "../../server";
import { TokenManager } from "../utils/jwt/JWT"
import EventEmitter from "events";
export default class CrudManager {
  pb: any;
  Config: any;
  tokenManager: TokenManager;
  evt: EventEmitter;
  subscriptions: Map<string, any>;
  constructor(pb: any, Config: any, tokenManager: TokenManager) {
    this.pb = pb;
    this.Config = Config;
    this.tokenManager = tokenManager;
    this.subscriptions = new Map();
    this.evt =  new EventEmitter()
  }
  async list(data: any) {
    let { collection, limit, offset, filter, sort, expand, returnable } = data.data
 
   
    switch (true) {
      case collection === "authState" || collection === "devAuthState":
        return { error: true, message: null, key: data.key };
      case !collection:
        return {
          error: true,
          message: "collection name is required",
          key: data.key,
        };
      case !data.token:
        return {
          error: true,
          message: "client auth token is required",
          key: data.key,
        };
      case limit && typeof limit !== "number":
        return {
          error: true,
          message: "limit must be a number",
          key: data.key,
        };
      case offset && typeof offset !== "number":
        return { error: true, message: "page must be a number", key: data.key };
      case filter && typeof filter !== "string":
        return {
          error: true,
          message: "filter must be a string",
          key: data.key,
        };
      case sort && typeof sort !== "string":
        return { error: true, message: "sort must be a string", key: data.key };
      case expand && !Array.isArray(expand):
        return {
          error: true,
          message: "expand must be an array",
          key: data.key,
        };
      case returnable && !Array.isArray(returnable):
        return {
          error: true,
          message: "returnable must be an array",
          key: data.key,
        };
      case !(await this.tokenManager.isValid(data.token, true)):
        return { error: true, message: "Invalid token", key: data.key };
      default:
        try {
          let expansion = ""
          expand ?  expand.forEach((d) => {
            expansion += `${d},`
          }): null
         
          
          let res: any = await pb.admins.client
            .collection(collection)
            .getList(offset, limit, {
              filter: filter || "",
              sort: sort || "created",
              expand: expansion || "",
            });
        
        

          collection === "users" && res.items.length > 0 && res.items.forEach((item) => {
            if (item.emailVisibility === false) delete item.email;
          });
          let newItems = res.items.map((item: any) => {
             
            let newRecord = {
              id: item.id,
              expand: {},
            };
 
            function recursiveObject(item: any) {
              
                
             switch (true) {
              case item.emailVisibility === false && item.email && item.email !== null:
                delete item.email;
                break;
              case item.expand && item.expand !== null:
                Object.keys(item.expand).forEach((key) => {
                  recursiveObject(item.expand[key]);
                });
                break;
              case Array.isArray(item):
                item.forEach((d) => {
                  recursiveObject(d);
                });
                break;
              default:
                break;
             }
                 
               
            }
      


            if(item.expand && item.expand !== null){  
              Object.keys(item.expand).forEach((key) => {
                recursiveObject(item.expand[key])
  
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
           
          
          return { error: false, key: data.key, data: res,  session: data.session };

           
        } catch (error) {
          console.log(error)
          return { error: true, message: error.message, key: data.key , session: data.session};
        }
    }
  }
  async subscribe(data: any, msg: any) {
    let { collection,  key, event, returnable } = data;
 
   console.log(data)
  }
  async unsubscribe(data: any) {
    try {
      this.evt.off(data.event)
      return { error: false, key: data.key };
    } catch (error) {
      return { error: true, message: error.message, key: data.key };
    }
  }

  async read(data: any) {
    switch (true) {
      case !data.collection ||
        data.collection === "authState" ||
        data.collection === "devAuthState":
        return {
          error: true,
          message: "Valid collection is required",
        };
      case !data.id:
        return {
          error: true,
          message: "id is required",
        };
      case data.returnable && !Array.isArray(data.returnable):
        return {
          error: true,
          message: "returnable must be an array",
        };
      default:
        let idFromToken = this.tokenManager.decode(data.token).id;

        try {
          let res = await this.pb.admins.client
            .collection(data.collection)
            .getOne(data.id, {
              expand: data.expand || [],
            });

          // Modify data based on specific conditions
          if (
            data.collection === "users" &&
            idFromToken !== data.id &&
            res.emailVisibility === false
          ) {
            delete res.email;
          }

          // Check for expand and returnable arrays
          if (
            data.expand &&
            Array.isArray(data.expand) &&
            ((data.returnable && Array.isArray(data.returnable)) ||
              (data.expand && !data.returnable))
          ) {
            let newRecord = {
              id: res.id,
              expand: {},
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
          global.shouldLog && console.log(error);
          return { error: true, message: error.message, key: data.key };
        }
    }
  }
  async create(data: any) {
    switch (true) {
        case data.collection === 'authState' || data.collection.includes('authState'):
            return { error: true, message: null, key: data.key };
        case !data.collection:
            return { error: true, message: 'collection name is required', key: data.key };
        case !data.record:
            return { error: true, message: 'record data is required', key: data.key };
        case !data.token && data.collection !== 'users' || !this.tokenManager.isValid(data.token, true):
            return { error: true, message: 'Invalid token', key: data.key };
        case data.epand && !Array.isArray(data.expand):
            return { error: true, message: 'expand must be an array', key: data.key };

        default:
            try {

                let expand = ""
                data.expand ? data.expand.forEach((d) => {
                  expand += `${d},`
                }): null
                 
                
                let res = await this.pb.admins.client.collection(data.collection).create(data.record, {
                  expand: expand || ""
                })
                this.evt.emit('create', {collection: data.collection, record: res, action: 'create'})
                return { error: false, key: data.key, data: res, session: data.session }
            } catch (error) {
              console.log(error.data)
               
                return { error: true, message: error.message, key: data.key , session: data.session}
            }
    }
}
  async update(data: any) {
        
    switch(true){
        case data.collection === 'authState' || data.collection.includes('authState'):
            return   { error: true, message: null, key: data.key };
           
        case !data.collection:
         return { error: true, message: 'collection name is required', key: data.key };
         
        case !data.id:
            return  { error: true, message: 'record id is required', key: data.key };
          
        case !data.token:
           return { error: true, message: 'client auth token is required', key: data.key };
           
        case !this.tokenManager.isValid(data.token, true):
            return { error: true, message: 'Invalid token', key: data.key };
           
       
        default:
          let idFromToken = this.tokenManager.decode(data.token).id;
          console.log(idFromToken, data.id)
          if(data.collection === 'users' && idFromToken !== data.id){
             let col = this.Config.cannotUpdate[data.collection]['others']
             for(let i in col){
               if(data.data[col[i]]){
                 return { error: true, message: `You are not authorized to update ${col[i]}`, key: data.key}
               }
             }
          }else if(data.collection === 'users' && idFromToken === data.id){
            let col = this.Config.cannotUpdate[data.collection]['self']
            for(let i in col){
              if(data.data[col[i]]){
                return { error: true, message: `You are not authorized to update ${col[i]}`, key: data.key}
              }
            }
          }
          break;
    }

   
    try {

             
            
             
      for(var i in data.data){
         
        if(data.data[i].isFile && data.data[i].file
        && data.data[i].update  
        ){
           
          const array = new Uint8Array(data.data[i].file);
          const blob = new Blob([array], { type: data.data[i].type });
          data.data[i] = new File([blob], data.data[i].name, { type: data.data[i].type });
          
             
        }else if(data.data[i].isFile && data.data[i].file && data.data[i].update !== true){
          delete data.data[i]
        }
    }

       let idFromToken = this.tokenManager.decode(data.token).id;
       
      

        let res = await this.pb.admins.client.collection(data.collection).update(data.id,   data.data)
        if(data.collection === 'users' && idFromToken !== data.id
        && res.emailVisibility === false
        ){
            delete  res.email
        }
        
        this.evt.emit('update', {collection: data.collection, record: res, action: 'update'})
        return { error: false, key: data.key, data: res, session: data.session }
    } catch (error) {
        return { error: true, message: error.message, key: data.key,  session: data.session}
    }
}
async delete(data: any) {
  console.log(data)
  switch (true) {
      case data.collection === 'authState' || data.collection.includes('authState'):
          return { error: true, message: null, key: data.key };
      case !(await this.tokenManager.isValid(data.token, true)):
            return { error: true, message: 'Invalid token', key: data.key };
      case !data.collection:
          return { error: true, message: 'collection name is required', key: data.key };
      case !data.id:
          return { error: true, message: 'record id is required', key: data.key };
      case !data.token:
          return { error: true, message: 'client auth token is required', key: data.key };
      case data.collection === 'users' && this.tokenManager.decode(data.token).id !== data.id:
          return { error: true, message: 'You are not authorized to perform this action', key: data.key };
      case  !data.ownership:
          return { error: true, message: 'ownership is required', key: data.key };
      case data.ownership && data.ownership !== this.tokenManager.decode(data.token).id:
        console.log(data.ownership, this.tokenManager.decode(data.token).id)
          return { error: true, message: 'You are not authorized to perform this action', key: data.key };
      default:
          try {
               let res = await this.pb.admins.client.collection(data.collection).delete(data.id)
               this.evt.emit('delete', {collection: data.collection, record: res, action: 'delete'})
              return { error: false, key: data.key, data: res, session: data.session }
          } catch (error) {
            console.log(error)
              return { error: true, message: error.message, key: data.key , token: data.token, session: data.session}
          }
  }
}
}
