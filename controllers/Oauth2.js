export default async function oauth2(tokenManager, pb, sendMessage, data){
      try {
        let res  = await pb.admins.client.collection('users').authWithOAuth2({
            provider: data.provider,
            createData: {
             bio: "I am new to Postr!",
             followers: [],
             following: [],
            },
            redirectUrl: data.redirect_uri,
            urlCallback: (url) => {
                sendMessage({
                    type: 'oauth',
                    key:'oauth',
                    data: {
                        url: url
                    }
                 
                })
            },
           }) 
    
     
           let newtoken = await tokenManager.sign(res.record.id, await tokenManager.generateSigningKey(res.record.id))
           res['token'] =  newtoken
         
           global.shouldLog && console.log(`User ${res.record.id} logged in`)
           
           sendMessage({type:'oauth', key:'oauth', clientData:res})
    
             
      } catch (error) {
        sendMessage({type:'oauth', key:'oauth', error: true, message: error.message})
        global.shouldLog && console.log(error)
        
      }
}