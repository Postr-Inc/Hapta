import jsonwebtoken from "jsonwebtoken" 
import { config } from ".."
class TokenManager  {
    TokenStore: Map<string, string>
    IpStore: Map<string, string>
    constructor(){
      this.TokenStore = new Map()
      this.IpStore = new Map()
    }
 

    create(data: {payload: any, password: string, ip: string} ){ 
      var token =  jsonwebtoken.sign(data.payload, config.Security.TokenSecret + data.password, {
        expiresIn: '12h'
      })

      this.IpStore.set(token, data.ip)
      this.TokenStore.set(token, config.Security.TokenSecret + data.password)
      return token
    }

    verify(ip, token){
       if(this.IpStore.get(token) != ip){
        return false;
       }

       return jsonwebtoken.verify(token,this.TokenStore.get(token) )
    }
    
}

export default TokenManager