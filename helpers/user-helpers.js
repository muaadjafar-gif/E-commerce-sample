var db = require('../config/connection')
var collection = require('../config/collections')
const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');
const { response } = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');

const createRazorpayClient = () => {
  const key_id = collection.RAZORPAY_KEY_ID;
  const key_secret = collection.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error('Razorpay credentials are not configured.');
  }

  return new Razorpay({ key_id, key_secret });
};

const isRazorpayConfigured = () => Boolean(
  collection.RAZORPAY_KEY_ID && collection.RAZORPAY_KEY_SECRET
);

module.exports={
    doSignup: async (userData) => {
  const hashedPassword = await bcrypt.hash(userData.password, 10);

  return db.get()
    .collection(collection.USER_COLLECTION)
    .insertOne({ ...userData, password: hashedPassword });
},
    
    doLogin:(userData)=>{
        return new Promise(async(resolve,reject)=>{
          let  loginStatus = false
          let response= {}
          let user =await db.get().collection(collection.USER_COLLECTION).findOne({email:userData.email})
          if(user){
            bcrypt.compare(userData.password,user.password).then((status)=>{
                if(status){
                    console.log("login success");
                    response.user = user
                    response.status = true
                    resolve(response)
                }else{
                    console.log("login failed");
                    resolve({status:false})
                    
                }
            })
          }else{
            console.log('user nott available');
            resolve({status:false})
            
          }

        })
    },
    addToCart: async (proId,userId)=>{
      const productObjectId = new ObjectId(proId)
      const proObj = {
        item: productObjectId,
        quantity: 1
      }
      const cartCollection = db.get().collection(collection.CART_COLLECTION)
      const userObjectId = new ObjectId(userId)
      const userCart = await cartCollection.findOne({ user: userObjectId })

      if (userCart) {
        const existingProduct = userCart.products.find(
          product => String(product.item || product) === String(productObjectId)
        )

        if (existingProduct) {
          if (existingProduct.item) {
            return cartCollection.updateOne(
              { _id: userCart._id, 'products.item': productObjectId },
              { $inc: { 'products.$.quantity': 1 } }
            )
          }

          return cartCollection.updateOne(
            { _id: userCart._id, products: productObjectId },
            { $set: { 'products.$': { ...proObj, quantity: 2 } } }
          )
        }

        return cartCollection.updateOne(
          { _id: userCart._id },
          { $push: { products: proObj } }
        )
      }

      return cartCollection.insertOne({
        user: userObjectId,
        products: [proObj]
      })
    },
    changeCartQuantity: async (proId, userId, change) => {
      const productObjectId = new ObjectId(proId)
      const userObjectId = new ObjectId(userId)
      const cartCollection = db.get().collection(collection.CART_COLLECTION)
      const cart = await cartCollection.findOne({ user: userObjectId })

      if (!cart || !Array.isArray(cart.products)) return null

      const quantities = new Map()
      for (const product of cart.products) {
        const productId = product.item || product
        const id = String(productId)
        quantities.set(id, (quantities.get(id) || 0) + (product.quantity || 1))
      }

      const productKey = String(productObjectId)
      if (!quantities.has(productKey)) return null

      const quantity = Math.max(1, quantities.get(productKey) + change)
      quantities.set(productKey, quantity)
      const products = [...quantities.entries()].map(([id, itemQuantity]) => ({
        item: new ObjectId(id),
        quantity: itemQuantity
      }))

      await cartCollection.updateOne(
        { _id: cart._id },
        { $set: { products } }
      )

      return {
        quantity,
        cartCount: [...quantities.values()].reduce((total, count) => total + count, 0)
      }
    },
    removeFromCart: async (proId, userId) => {
      const productKey = String(new ObjectId(proId))
      const cartCollection = db.get().collection(collection.CART_COLLECTION)
      const cart = await cartCollection.findOne({ user: new ObjectId(userId) })

      if (!cart || !Array.isArray(cart.products)) return null

      const products = cart.products.filter(product => {
        const productId = product.item || product
        return String(productId) !== productKey
      })

      if (products.length === cart.products.length) return null

      await cartCollection.updateOne(
        { _id: cart._id },
        { $set: { products } }
      )

      return {
        cartCount: products.reduce(
          (count, product) => count + (product.quantity || 1),
          0
        )
      }
    },
   getCartProduct: async (userId) => {
    const cart = await db.get()
      .collection(collection.CART_COLLECTION)
      .findOne({ user: new ObjectId(userId) })

    if (!cart || !cart.products || cart.products.length === 0) return []

    const quantities = new Map()
    const productIds = cart.products.map(product => {
      const productId = product.item || product
      const id = String(productId)
      quantities.set(
        id,
        (quantities.get(id) || 0) + (product.quantity || 1)
      )
      return productId
    })

    const uniqueProductIds = [...new Map(
      productIds.map(productId => [String(productId), productId])
    ).values()]

    const products = await db.get()
      .collection(collection.PRODUCT_COLLECTION)
      .find({ _id: { $in: uniqueProductIds } })
      .toArray()

    return products.map(product => ({
      ...product,
      quantity: quantities.get(String(product._id)) || 1
    }))
  },
  getCartCount: async (userId) => {
    const cart = await db.get()
      .collection(collection.CART_COLLECTION)
      .findOne({ user: new ObjectId(userId) })

    if (!cart || !cart.products) return 0

    return cart.products.reduce(
      (count, product) => count + (product.quantity || 1),
      0
    )
  },
  placeOrder: async (order, products, total, userId) => {
    const isCashOnDelivery = order['payment-method'] === 'COD';
    const userObjectId = new ObjectId(userId);
    const orderObj = {
      deliveryDetails: {
        mobile: order.mobile,
        pincode: order.pincode,
        address: order.address
      },
      userId: userObjectId,
      orderDate: new Date(),
      paymentMethod: order['payment-method'],
      products,
      total,
      status: isCashOnDelivery ? 'placed' : 'pending'
    };

    const result = await db.get()
      .collection(collection.ORDER_COLLECTION)
      .insertOne(orderObj);

    if (isCashOnDelivery) {
      await db.get().collection(collection.CART_COLLECTION)
        .deleteOne({ user: userObjectId });
    }

    return result.insertedId.toString();
  },
  generateRazorpay: async (total, receipt) => {
    const amount = Math.round(Number(total) * 100);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error('Razorpay order amount must be a positive, safe integer in paise.');
    }

    return createRazorpayClient().orders.create({
      amount,
      currency: 'INR',
      receipt: String(receipt)
    });
  },
  isRazorpayConfigured,
  markOrderPaymentFailed: async (orderId) => db.get()
    .collection(collection.ORDER_COLLECTION)
    .updateOne(
      { _id: new ObjectId(orderId), paymentMethod: 'Online', status: 'pending' },
      { $set: { status: 'payment_failed', paymentStatus: 'failed' } }
    ),
  saveRazorpayOrderId: async (orderId, razorpayOrderId) => {
    return db.get().collection(collection.ORDER_COLLECTION).updateOne(
      { _id: new ObjectId(orderId) },
      { $set: { razorpayOrderId } }
    );
  },
  verifyRazorpayPayment: async (payment, userId) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = payment;
    const keySecret = collection.RAZORPAY_KEY_SECRET;

    if (!keySecret || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const receivedBuffer = Buffer.from(razorpay_signature, 'hex');

    if (expectedBuffer.length !== receivedBuffer.length ||
        !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
      return false;
    }

    const result = await db.get().collection(collection.ORDER_COLLECTION).updateOne(
      {
        razorpayOrderId: razorpay_order_id,
        userId: new ObjectId(userId),
        paymentMethod: 'Online',
        status: 'pending'
      },
      {
        $set: {
          status: 'placed',
          paymentStatus: 'paid',
          razorpayPaymentId: razorpay_payment_id
        }
      }
    );

    if (result.modifiedCount !== 1) return false;

    await db.get().collection(collection.CART_COLLECTION)
      .deleteOne({ user: new ObjectId(userId) });

    return true;
  },
  getUserOrders:(userId)=>{
    return new Promise((resolve,reject)=>{
      const orders = db.get().collection(collection.ORDER_COLLECTION)
      .find({userId:new ObjectId(userId)}).toArray()
      resolve(orders)
    })
  }
}