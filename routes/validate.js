

export default async function validate(req,res){
  try {
    let email = req.params.email
    let username = req.params.username
    if(!email || !username){
      res.send({
        error: true,
        message: 'email and username are required'
      })
      return;
    }
    let res = await global.pb.admins.client.collection('users').getList(1,1, {
      filter:`email="${email}" || username="${username}"`
    })
    let message = {
      email: false,
      username: false
    }
    if(res.items.length > 0){
      res.items.forEach((d)=>{
        if(d.email === email){
          message.email = true
        }
        if(d.username.toLowerCase() === username.toString().toLowerCase()){
          message.username = true
        }
      })
    }
    res.json(message)
    
  } catch (error) {
    
     res.send({
       error: true,
       message: error.message
     })
  }
}