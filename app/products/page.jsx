'use client';
import { useState, useEffect } from 'react';
import { useCart } from '@/lib/CartContext';
import Link from 'next/link';



export default function ProductList() {
  const { addToCart } = useCart();
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => setProducts(data))
      .catch((err) => console.error('Failed to fetch products:', err));
  }, []);   

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-8">
          Products
        </h1>
        <div className="flex justify-end mb-4">
          <Link
            href="/cart"
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Cart
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-lg shadow-lg p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900">
                {product.name}
              </h2>
              <p className="text-gray-600 mt-2">{product.description}</p>
              <p className="text-lg font-medium text-gray-900 mt-2">
                ${product.price.toFixed(2)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Category: {product.category}
              </p>
              <button
                type="button"
                onClick={() => addToCart(product)}
                className="mt-4 w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add to Cart
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
