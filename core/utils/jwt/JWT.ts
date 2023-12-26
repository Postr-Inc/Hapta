//@ts-nocheck
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ErrorCodes, ErrorHandler } from '../../controllers/ErrorHandler';
import Pocketbase from 'pocketbase';
 
export class TokenManager{
    serverKeys: any
    pb: Pocketbase
    devKeys: any
    clientKeys: Map<string, any>
    constructor(Pocketbase){
        this.clientKeys = new Map()
        this.devKeys = new Map()
        this.pb = Pocketbase
        this.startUp()
    }

    async startUp(){
         
        
         try {
            this.pb.admins.client.collection('authState').getFullList().then((res)=>{
                res.forEach((d)=>{
                    this.clientKeys.set(d.User, {key: d.signing_key, id: d.id})
                })
            })
    
            this.pb.admins.client.collection('devAuthState').getFullList().then((res)=>{
                res.forEach((d)=>{
                    this.devKeys.set(d.dev, {key: d.signing_key, id: d.id})
                })
            })
         } catch (error) {
             throw new ErrorHandler(error).handle({code:  ErrorCodes.MISSING_AUTH_STATE_RECORDS})
         }
 
       
    }

    sign(Uid: string, signingKey:string){
        
        return new Promise((resolve, reject) => {
            jwt.sign({id: Uid }, signingKey, {expiresIn: '30d'}, (err, token) => {
                if(err) reject(err)
                resolve(token)
            })
        })
    }

    /**
     * @description Generates a signing key for a user or developer and stores in the database
     * @param Uid 
     * @param client 
     * @returns 
     */
    async generateSigningKey(Uid: any, client: any = null){
        await this.pb.admins.authWithPassword(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD)
        let randomKey = crypto.randomBytes(64).toString('hex')
        
        if(this.clientKeys.has(Uid) || this.devKeys.has(Uid)){
            try {
                await this.pb.admins.client.collection(client ? 'authState': 'devAuthState').update(client ? this.clientKeys.get(Uid).id : this.devKeys.get(Uid).id, {signing_key: randomKey})
                client ? this.clientKeys.set(Uid, {key: randomKey, id: this.clientKeys.get(Uid).id}) : this.devKeys.set(Uid, {key: randomKey, id: this.devKeys.get(Uid).id})
                return randomKey
            } catch (error) {
                 
                return new ErrorHandler(error).handle({code:  ErrorCodes.AUTHKEYGENERATION_FAILED})
            }
        }
      try {
        let res =  await this.pb.admins.client.collection(client ? 'authState': 'devAuthState').create({User: Uid, signing_key: randomKey})
        client ? this.clientKeys.set(Uid, {key: randomKey, id: res.id}) : this.devKeys.set(Uid, {key: randomKey, id: res.id})
      } catch (error) {
        return new ErrorHandler(error).handle({code:  ErrorCodes.AUTHKEYGENERATION_FAILED})
      }
        return randomKey
    }

    decode(token: string){
        return jwt.decode(token)
    }

    removeSigningKey(id: string, client: any = null){
        client ? this.clientKeys.delete(id) : this.devKeys.delete(id)
    }

    async getSigningKey(id: string, client: any = null){
         
        switch(true){
            case !id:
                return null
            case this.clientKeys.has(id) || this.devKeys.has(id):
                return client ? this.clientKeys.get(id).key : this.devKeys.get(id).key
            default:
             return await this.generateSigningKey(id, client)
        }
    }

    

    async isValid(token: string, client: any = null){
         
        let decoded = jwt.decode(token) as any
        if(!decoded) return false
        let signingKey = await this.getSigningKey(decoded.id, client)
        if(!signingKey) return false
        let res =  jwt.verify(token, signingKey)
        return res
    }
    
}
 