const { randomUUID } = require('crypto')
const cloudinary = require('cloudinary').v2
const path = require('path')

const getCloudinary = () => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error(
      'Product image uploads require CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.'
    )
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true
  })

  return cloudinary
}

module.exports = {
  uploadProductImage: (image, productId) => new Promise((resolve, reject) => {
    const upload = getCloudinary().uploader.upload_stream({
      folder: 'e-commerce/products',
      public_id: `${productId}-${randomUUID()}`,
      resource_type: 'image'
    }, (error, result) => {
      if (error) return reject(error)
      if (!result || !result.secure_url || !result.public_id) {
        return reject(new Error('Cloudinary returned an incomplete product image upload result.'))
      }

      resolve({
        url: result.secure_url,
        publicId: result.public_id
      })
    })

    upload.end(image.data)
  }),

  deleteProductImage: async (publicId) => {
    const result = await getCloudinary().uploader.destroy(publicId, {
      resource_type: 'image'
    })
    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error(`Cloudinary could not delete product image "${publicId}".`)
    }
  },

  imageUrl: (image) => {
    if (!image) return ''

    const imageValue = String(image).trim()
    if (/^https?:\/\//i.test(imageValue)) return imageValue

    const filename = path.posix.basename(imageValue.replace(/\\/g, '/'))
    return filename ? `/images/product-images/${encodeURIComponent(filename)}` : ''
  }
}
