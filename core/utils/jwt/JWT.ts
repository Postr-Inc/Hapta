//@ts-nocheck

import jwt from 'jsonwebtoken';
let crypto = require('crypto')

 
 
export class TokenManager{
    serverKeys: any
    pb: any
    devKeys: any
    clientKeys: Map<string, any>
    constructor(Pocketbase){
        this.clientKeys = new Map()
        this.devKeys = new Map()
        this.pb = Pocketbase
        this.startUp()
    }

    async startUp(){
       await this.pb.admins.client.collection('authState').getFullList().then((res)=>{
            res.forEach((d)=>{
                this.clientKeys.set(d.User, {key: d.signing_key, id: d.id})
            })
        })

        await this.pb.admins.client.collection('devAuthState').getFullList().then((res)=>{
            res.forEach((d)=>{
                this.devKeys.set(d.dev, {key: d.signing_key, id: d.id})
            })
        })

        console.log("Token manager started")
    }

    sign(Uid: string, signingKey: string){
        
        return new Promise((resolve, reject) => {
            jwt.sign({id: Uid }, signingKey, {expiresIn: '30d'}, (err, token) => {
                if(err) reject(err)
                resolve(token)
            })
        })
    }

    /**
     * @description Generates a signing key for a user
     * @param Uid 
     * @param client 
     * @returns 
     */
    async generateSigningKey(Uid: any, client: any = null){
        await this.pb.admins.authWithPassword(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD)
        let randomKey =  crypto.randomUUID()
        
        if(client ? this.clientKeys.has(Uid) : this.devKeys.has(Uid)){
            try {
                await this.pb.admins.client.collection(client ? 'authState': 'devAuthState').update(client ? this.clientKeys.get(Uid).id : this.devKeys.get(Uid).id, {signing_key: randomKey})
                this.clientKeys.set(Uid, {key: randomKey, id:  this.clientKeys.get(Uid).id})
                return randomKey
            } catch (error) {
                console.log(error)
                return null
            }
        }
        let res =  await this.pb.admins.client.collection(client ? 'authState': 'devAuthState').create(client ? {User: Uid, signing_key: randomKey} : {dev: Uid, signing_key: randomKey})
        client ? this.clientKeys.set(Uid, {key: randomKey, id: res.id}) : this.devKeys.set(Uid, {key: randomKey, id: res.id})
        return randomKey
    }

    decode(token){
        
        return jwt.decode(token)
    }

    removeSigningKey(id: string, client: any = null){
        client ? this.clientKeys.delete(id) : this.devKeys.delete(id)
    }

    async getSigningKey(id: string, client: any = null){
         
        switch(true){
            case !id:
                return null
            case  this.clientKeys.has(id) || this.devKeys.has(id):
                return client ? this.clientKeys.get(id).key : this.devKeys.get(id).key
            default:
             return await this.generateSigningKey(id, client)
        }
    }

    

    async isValid(token, client: any = null){
         
        try {
             
            let signingKey = await this.getSigningKey(this.decode(token).id, client)           
            jwt.verify(token,  signingKey)
            return true
        } catch (error) {
            console.log(error)
            return false
        }
    }
    
}
 