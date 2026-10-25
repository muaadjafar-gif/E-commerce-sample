const MongoClient = require('mongodb').MongoClient;

const state ={
    db:null
}

module.exports.connect = async function(){
 const url = process.env.MONGODB_URI ||
   (process.env.NODE_ENV === 'production' ? null : 'mongodb://localhost:27017')
 const dbname = process.env.MONGODB_DB_NAME || 'shopping'

 if (!url) {
  throw new Error('MONGODB_URI must be configured in production.')
 }

 const client = await MongoClient.connect(url)
 state.db = client.db(dbname)
}


module.exports.get= function(){
    return state.db
}
