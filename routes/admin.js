var express = require('express');
var router = express.Router();
var path = require('path');
var fs = require('fs').promises;
var ObjectId = require('mongodb').ObjectId;
var productHelper = require('../helpers/product-helpers')

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
  const imageName = productId.toString() + extension;
  const imagePath = path.join(__dirname, '..', 'public', 'images', 'product-images', imageName);
  let imageSaved = false;

  try {
    await fs.mkdir(path.dirname(imagePath), { recursive: true });
    await image.mv(imagePath);
    imageSaved = true;

    let product = {
      ...req.body,
      _id: productId,
      image: imageName
    };
    const result = await productHelper.addProduct(product);
    console.log('Product insert result:', result);
    res.redirect('/admin');
  } catch (error) {
    if (imageSaved) {
      try {
        await fs.unlink(imagePath);
      } catch (cleanupError) {
        console.error('Failed to remove product image after insert failure:', cleanupError);
      }
    }
    next(error);
  }
})

router.get('/delete-product/:id',(req,res)=>{
  let proId = req.params.id
  console.log(proId);
  productHelper.deleteProduct(proId).then(()=>{
    res.redirect('/admin')
  })
})

router.get('/edit-product/:id',async(req,res)=>{
  let product = await productHelper.getProductDetails(req.params.id)
  res.render('admin/edit-product', { admin: true, product })

})

router.post('/edit-product/:id', async (req, res, next) => {
  try {
    const product = { ...req.body };
    const image = req.files && req.files.image;

    if (image) {
      const extension = path.extname(image.name).toLowerCase();
      const imageName = `${req.params.id}${extension}`;
      const imagePath = path.join(
        __dirname,
        '..',
        'public',
        'images',
        'product-images',
        imageName
      );

      await image.mv(imagePath);
      product.image = imageName;
    }

    await productHelper.updateProduct(req.params.id, product);
    res.redirect('/admin');
  } catch (error) {
    next(error);
  }
});

module.exports = router;
