function addToCart(proId){
      $.ajax({
        url:'/add-to-cart/'+proId,
        method: 'get',
        success:(response)=>{
            if(response.status){
                let count = $('#count').html()
                count = parseInt(count)+1
                $('#count').html(count)
            }
        }
      })
    }

function updateCartTotal(totalPrice) {
  const totalElement = document.getElementById('cart-total')
  if (!totalElement) return

  totalElement.textContent = String(totalPrice)
}

function changeCartQuantity(productId, change, button) {
  const row = button.closest('.cart-item-row')
  const quantityElement = row.querySelector('.cart-quantity')
  const buttons = row.querySelectorAll('button')

  buttons.forEach((item) => {
    item.disabled = true
  })

  $.ajax({
    url: '/change-cart-quantity',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({ productId, change }),
    success: (response) => {
      if (response.status) {
        quantityElement.textContent = response.quantity
        updateCartTotal(response.totalPrice)
        const cartCount = document.getElementById('count')
        if (cartCount) cartCount.textContent = response.cartCount
      }
    },
    error: (xhr) => {
      console.error(
        'Could not update cart quantity:',
        xhr.responseJSON?.message || xhr.statusText
      )
    },
    complete: () => {
      buttons.forEach((item) => {
        item.disabled = false
      })
    }
  })
}

function removeFromCart(productId, button) {
  const row = button.closest('.cart-item-row')
  button.disabled = true

  $.ajax({
    url: '/remove-from-cart',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({ productId }),
    success: (response) => {
      if (!response.status) return

      row.remove()
      updateCartTotal(response.totalPrice)
      const cartCount = document.getElementById('count')
      if (cartCount) cartCount.textContent = response.cartCount

      if (!document.querySelector('.cart-item-row')) {
        const main = document.querySelector('main')
        main.innerHTML = '<div class="w-full"><h2 class="pt-8 text-center text-3xl font-bold text-slate-900">Cart is empty</h2></div>'
      }
    },
    error: (xhr) => {
      button.disabled = false
      alert(xhr.responseJSON?.message || 'Could not remove this product from your cart.')
    }
  })
}

const productSearch = document.getElementById('product-search')
if (productSearch) {
  const productRows = Array.from(document.querySelectorAll('#product-table-body .product-row'))
  const noProductMatches = document.getElementById('no-product-matches')
  const searchResults = document.getElementById('product-search-results')

  productSearch.addEventListener('input', () => {
    const query = productSearch.value.trim().toLocaleLowerCase()
    let visibleCount = 0

    productRows.forEach((row) => {
      const searchableText = [row.cells[1].textContent, row.cells[2].textContent, row.cells[3].textContent]
        .join(' ')
        .toLocaleLowerCase()
      const matches = searchableText.includes(query)

      row.hidden = !matches
      if (matches) visibleCount += 1
    })

    noProductMatches.hidden = visibleCount > 0
    searchResults.textContent = query
      ? `Showing ${visibleCount} of ${productRows.length} products`
      : `Showing ${productRows.length} products`
  })
}