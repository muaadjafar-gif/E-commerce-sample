var express = require("express");
var router = express.Router();
var productHelper = require('../helpers/product-helpers')
var userHelpers = require('../helpers/user-helpers');
const { ObjectId } = require('mongodb')
const collection = require('../config/collections')

router.use(function(req, res, next) {
  res.set('Cache-Control', 'no-store')
  next()
})

const verifyLoggin = (req,res,next)=>{
  if(  req.session.user && req.session.user.loggedIn && req.session.user._id){
    next()
  }else{
    res.redirect('/login')
  }
}

const calculateCartTotal = (products) => products.reduce(
  (total, product) => total + Number(product.price) * product.quantity,
  0
)

/* GET home page. */
router.get("/", function (req, res, next) {
  let user = req.session.user
    productHelper.getAllProducts().then(async(product)=>{
      let cartCount = null
      if(req.session.user){
        cartCount =await userHelpers.getCartCount(req.session.user._id)
      }

        const productsWithNumbers = product.map((product, index) => ({
      ...product,
      number: index + 1,
    }));
  res.render("user/view-products", { products: productsWithNumbers , admin:false, user,cartCount });
    })
});

router.get('/adminlogin',(req,res)=>{
   if(req.session.adminLoggedIn){
    res.redirect('/admin')
  }else{
      const loginErr = req.session.adminLoginErr
      req.session.adminLoginErr = false
      res.render('admin/login', { admin: true, adminLoggedIn: false, loginErr })
  }
})

router.post('/adminlogin', (req,res,next)=>{
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminEmail || !adminPassword) {
    return next(new Error('Admin credentials are not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD.'))
  }

  const { email, password } = req.body
  if (email?.trim().toLowerCase() !== adminEmail.trim().toLowerCase() ||
      password !== adminPassword) {
    req.session.adminLoginErr = true
    return res.redirect('/adminlogin')
  }

  req.session.regenerate((error)=>{
    if (error) return next(error)
    req.session.adminLoggedIn = true
    res.redirect('/admin')
  })
})

router.get('/adminlogout', (req,res)=>{
  req.session.adminLoggedIn = false
  res.redirect('/adminlogin')
})


router.get('/login', function(req,res){
  if(req.session.user && req.session.user.loggedIn){
    res.redirect('/')
  }else{
      const loginErr = req.session.userLoginErr
      req.session.userLoginErr = false
      res.render('user/login', { loginErr })
  }
})
router.get('/signup', function(req,res){
  res.render('user/signup')
})
router.post('/signup', function (req, res, next) {
  userHelpers.doSignup(req.body)
    .then((response) =>{
       req.session.user = { _id: response.insertedId, email: req.body.email }
      req.session.user.loggedIn = true
      res.redirect('/')
    })
    .catch(next);
});

router.post('/login', (req,res,next)=>{
  userHelpers.doLogin(req.body).then((response)=>{
    if(response.status){
      req.session.user = response.user
      req.session.user.loggedIn = true
      res.redirect('/')
    }else{
      req.session.userLoginErr = true
      res.redirect('/login')
    }
  }).catch(next)
})

router.get('/logout',(req,res)=>{
  req.session.user = null
  res.redirect('/')
})

router.get('/cart', verifyLoggin, async (req, res, next) => {
  try {
    const products = await userHelpers.getCartProduct(req.session.user._id)
    const cartCount = await userHelpers.getCartCount(req.session.user._id)
    const totalPrice = calculateCartTotal(products)
    res.render('user/cart', { products, user: req.session.user, cartCount, totalPrice })
    
  } catch (error) {
    next(error)
  }
})

router.post('/place-order', verifyLoggin, async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const paymentMethod = req.body['payment-method'];

    if (!['COD', 'Online'].includes(paymentMethod)) {
      return res.status(400).json({ status: false, message: 'Invalid payment method.' });
    }

    const products = await userHelpers.getCartProduct(userId);
    if (!products.length) {
      return res.status(400).json({ status: false, message: 'Your cart is empty.' });
    }

    const totalPrice = calculateCartTotal(products);
    const orderId = await userHelpers.placeOrder(req.body, products, totalPrice, userId);

    if (paymentMethod === 'COD') {
      return res.json({ status: true, paymentMethod });
    }

    const razorpayOrder = await userHelpers.generateRazorpay(totalPrice, orderId);
    await userHelpers.saveRazorpayOrderId(orderId, razorpayOrder.id);

    res.json({
      status: true,
      paymentMethod,
      keyId: collection.RAZORPAY_KEY_ID,
      razorpayOrder,
      prefill: { email: req.session.user.email }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/verify-payment', verifyLoggin, async (req, res, next) => {
  try {
    const verified = await userHelpers.verifyRazorpayPayment(
      req.body,
      req.session.user._id
    );
    
    if (!verified) {
      return res.status(400).json({ status: false, message: 'Payment verification failed.' });
    }
    
    res.json({ status: true });
  } catch (error) {
    next(error);
  }
})

router.get('/place-order', verifyLoggin, async (req, res, next) => {
  try {
    const products = await userHelpers.getCartProduct(req.session.user._id)
    const totalPrice = calculateCartTotal(products)
    const cartCount = await userHelpers.getCartCount(req.session.user._id)
    res.render('user/place-order', { user: req.session.user, cartCount, totalPrice })
  } catch (error) {
    next(error)
  }
})

router.get('/add-to-cart/:id', verifyLoggin, async(req,res,next)=>{
  try {
    await userHelpers.addToCart(req.params.id,req.session.user._id)
    res.json({status:true})
  } catch (error) {
    next(error)
  }
})

router.post('/change-cart-quantity', verifyLoggin, async (req, res, next) => {
  try {
    const { productId, change } = req.body
    if (!productId || ![-1, 1].includes(Number(change)) ||
        !ObjectId.isValid(productId)) {
      return res.status(400).json({ status: false, message: 'Invalid cart quantity update.' })
    }

    const result = await userHelpers.changeCartQuantity(
      productId,
      req.session.user._id,
      Number(change)
    )

    if (!result) {
      return res.status(404).json({ status: false, message: 'Product was not found in your cart.' })
    }

    const products = await userHelpers.getCartProduct(req.session.user._id)
    res.json({ status: true, ...result, totalPrice: calculateCartTotal(products) })
  } catch (error) {
    next(error)
  }
})

router.post('/remove-from-cart', verifyLoggin, async (req, res, next) => {
  try {
    const { productId } = req.body
    if (!productId || !ObjectId.isValid(productId)) {
      return res.status(400).json({ status: false, message: 'Invalid product ID.' })
    }

    const result = await userHelpers.removeFromCart(
      productId,
      req.session.user._id
    )

    if (!result) {
      return res.status(404).json({ status: false, message: 'Product was not found in your cart.' })
    }

    const products = await userHelpers.getCartProduct(req.session.user._id)
    res.json({ status: true, ...result, totalPrice: calculateCartTotal(products) })
  } catch (error) {
    next(error)
  }
})

router.get('/order-success',(req,res)=>{
    res.render('user/order-success',{user:req.session.user})
})

router.get('/orders', verifyLoggin, async(req,res,next)=>{
  try {
    const orders = await userHelpers.getUserOrders(req.session.user._id)
    const formattedOrders = orders.map(order => ({
      ...order,
      displayDate: new Intl.DateTimeFormat('en', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(order.orderDate || order._id.getTimestamp())
    }))
    res.render('user/orders', { user: req.session.user, orders: formattedOrders })
  } catch (error) {
    next(error)
  }
})

module.exports = router;
