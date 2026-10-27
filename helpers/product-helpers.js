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
    deleteProduct: (proId) => db.get()
        .collection(collection.PRODUCT_COLLECTION)
        .deleteOne({ _id: new objectId(proId) }),
    getProductDetails: (proId) => db.get()
        .collection(collection.PRODUCT_COLLECTION)
        .findOne({ _id: new objectId(proId) }),

    updateProduct: (proId, proDetails) => db.get()
        .collection(collection.PRODUCT_COLLECTION)
        .updateOne({ _id: new objectId(proId) }, {
            $set: {
                name: proDetails.name,
                category: proDetails.category,
                price: proDetails.price,
                description: proDetails.description,
                ...(proDetails.image ? {
                    image: proDetails.image,
                    imagePublicId: proDetails.imagePublicId
                } : {})
            }
        })
}