var express = require('express');
var router = express.Router();
var path = require('path');
var ObjectId = require('mongodb').ObjectId;
var productHelper = require('../helpers/product-helpers')
var imageStorage = require('../helpers/image-storage')

router.use((req, res, next) => {
  if (req.session.adminLoggedIn) {
    res.locals.adminLoggedIn = true
    return next()
  }
  res.redirect('/adminlogin')
})

/* GET users listing. */
router.get('/', function(req, res, next) {
  productHelper.getAllProducts().then((product)=>{
      const productsWithNumbers = product.map((product, index) => ({
    ...product,
    number: index + 1,
  }));
  res.render('admin/view-products', { admin: true, products: productsWithNumbers });
  })

});

router.get('/add-product', function(req, res, next) {
  res.render('admin/add-product', { admin: true });
});
router.post('/add-product', async function(req, res, next) {
  const image = req.files && req.files.image;
  if (!image) {
    return res.status(400).send('A product image is required.');
  }

  const extension = path.extname(image.name).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension)) {
    return res.status(400).send('Product image must be a JPG, PNG, GIF, or WebP file.');
  }

  const productId = new ObjectId();
  let uploadedImage;

  try {
    uploadedImage = await imageStorage.uploadProductImage(image, productId.toString())

    let product = {
      ...req.body,
      _id: productId,
      image: uploadedImage.url,
      imagePublicId: uploadedImage.publicId
    };
    const result = await productHelper.addProduct(product);
    console.log('Product insert result:', result);
    res.redirect('/admin');
  } catch (error) {
    if (uploadedImage) {
      try {
        await imageStorage.deleteProductImage(uploadedImage.publicId)
      } catch (cleanupError) {
        console.error('Failed to remove product image from Cloudinary after insert failure:', cleanupError);
      }
    }
    next(error);
  }
})

router.get('/delete-product/:id', async (req, res, next) => {
  try {
    await productHelper.deleteProduct(req.params.id)
    res.redirect('/admin')
  } catch (error) {
    next(error)
  }
})

router.get('/edit-product/:id', async (req, res, next) => {
  try {
    const product = await productHelper.getProductDetails(req.params.id)
    if (!product) return res.sendStatus(404)
    res.render('admin/edit-product', { admin: true, product })
  } catch (error) {
    next(error)
  }
})

router.post('/edit-product/:id', async (req, res, next) => {
  let uploadedImage
  let productUpdated = false
  try {
    const product = { ...req.body };
    const image = req.files && req.files.image;
    const currentProduct = await productHelper.getProductDetails(req.params.id)
    if (!currentProduct) return res.sendStatus(404)

    if (image) {
      const extension = path.extname(image.name).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension)) {
        return res.status(400).send('Product image must be a JPG, PNG, GIF, or WebP file.');
      }

      uploadedImage = await imageStorage.uploadProductImage(image, req.params.id)
      product.image = uploadedImage.url
      product.imagePublicId = uploadedImage.publicId
    }

    await productHelper.updateProduct(req.params.id, product);
    productUpdated = true

    res.redirect('/admin');
  } catch (error) {
    if (uploadedImage && !productUpdated) {
      try {
        await imageStorage.deleteProductImage(uploadedImage.publicId)
      } catch (cleanupError) {
        console.error('Failed to remove product image from Cloudinary after update failure:', cleanupError)
      }
    }
    next(error);
  }
});

module.exports = router;
