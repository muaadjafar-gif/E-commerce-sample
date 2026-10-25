var db = require('../config/connection')
var collection = require('../config/collections')
var objectId = require('mongodb').ObjectId

module.exports={
    addProduct: (product)=>{
        console.log('Product received:', product);
        return db.get().collection('product').insertOne(product);
    },
    getAllProducts: ()=>{
        return new Promise(async(resolve,reject)=>{
            let products = await db.get().collection(collection.PRODUCT_COLLECTION).find().toArray()
            resolve(products)
        })
    },
    deleteProduct:(proId)=>{
        return new Promise((resolve,reject)=>{
            db.get().collection(collection.PRODUCT_COLLECTION).deleteOne({_id:new objectId(proId)}).then((response)=>{
                console.log(response);
                resolve(response)
                
            })
        })
    },
    getProductDetails:(proId)=>{
        return new Promise((resolve,reject)=>{
            db.get().collection(collection.PRODUCT_COLLECTION).findOne({_id:new objectId(proId)}).then((product)=>{
                resolve(product)

            })
        })

    },

    updateProduct:(proId,proDetails)=>{
        return new Promise((resolve,reject)=>{
            db.get().collection(collection.PRODUCT_COLLECTION).updateOne({_id: new objectId(proId)},{
                $set:{
                    name:proDetails.name,
                    category:proDetails.category,
                    price:proDetails.price,
                    description:proDetails.description,
                    ...(proDetails.image ? { image: proDetails.image } : {})
                }
            }).then((response)=>{
                resolve()
            })
        })
    }
}