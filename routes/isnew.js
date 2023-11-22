export default async function isNew(req, res){
 let result = await global.pb.admins.client.collection('users').getOne(req.params.id).then((res)=>{
    console.log(res)
    let created = new Date(res.created)
    let now = new Date()
    let diff = now - created
    let days = diff / (1000 * 60 * 60 * 24)
    let isNew = days < 7
    return {error: false, isNew}
  }).catch((err)=>{
    return {error: true, message: err.message}
  })
  res.json(result)
}