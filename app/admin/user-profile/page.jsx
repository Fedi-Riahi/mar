'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import useAuth from '../../../lib/useAuth';
import ProductForm from '@/app/admin/product-form/page';

export default function UserProfile() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('id'); // Get the user ID from URL params

  const [userData, setUserData] = useState(null);
  const [userProducts, setUserProducts] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && (!user || user.role !== 'ADMIN')) {
      router.push('/signin');
      return;
    }

    if (userId && user && user.role === 'ADMIN') {
      // Fetch user data
      fetch(`/api/users/${userId}`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load user');
          return res.json();
        })
        .then((data) => setUserData(data))
        .catch((err) => setError(err.message));

      // Fetch products for the specific userId
      fetch(`/api/products?userId=${userId}`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load products');
          return res.json();
        })
        .then((data) => setUserProducts(Array.isArray(data) ? data : []))
        .catch((err) => setError(err.message));
    }
  }, [userId, user, loading, router]);

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600"></div>
    </div>
  );

  if (error || !user || user.role !== 'ADMIN') return (
    <div className="min-h-screen bg-gray-100 p-6 lg:p-8 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Error</h2>
          <p className="text-gray-600 mb-6">{error || 'Unauthorized access'}</p>
          <button
            onClick={() => router.push('/admin')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Admin Dashboard
          </button>
        </div>
      </div>
    </div>
  );

  if (!userId) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 lg:p-8 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">User ID not found</h2>
            <p className="text-gray-600 mb-6">Please select a user from the admin dashboard.</p>
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Admin Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              {userData ? `${userData.name}'s Profile` : 'User Profile'}
            </h1>
            <div className="flex space-x-4">
              <Link
                href={{
                  pathname: '/admin/product-form',
                  query: { userId }
                }}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-105"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Create Product
              </Link>
              <button
                onClick={() => router.push('/admin')}
                className="text-gray-600 hover:text-gray-800 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
              <svg className="w-5 h-5 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          )}

          {userData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-gray-600 mb-8">
              <div>
                <span className="font-medium">Email:</span> {userData.email}
              </div>
              <div>
                <span className="font-medium">Role:</span> {userData.role}
              </div>
              <div>
                <span className="font-medium">Joined:</span> {new Date(userData.createdAt).toLocaleDateString()}
              </div>
            </div>
          )}

          <h2 className="text-2xl font-semibold text-gray-900 mb-6">User's Products</h2>
          {userProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {userProducts.map((product) => (
                <div key={product.id} className="bg-gray-50 rounded-lg p-4 shadow-sm">
                  <img
                    src={product.pictures[0] || '/placeholder-image.jpg'}
                    alt={product.name}
                    className="w-full h-40 object-cover rounded-lg mb-4"
                  />
                  <h3 className="text-lg font-medium text-gray-900">{product.name}</h3>
                  <p className="text-gray-600">{product.description.substring(0, 100)}...</p>
                  <p className="text-gray-600 font-medium">Price: ${product.price}</p>
                  <p className="text-gray-600">Stock: {product.stock}</p>
                  <p className="text-gray-600">Category: {product.category}</p>
                  <Link
                    href={{
                      pathname: '/admin/product-form',
                      query: { userId, id: product.id }
                    }}
                    className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Edit Product
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">No products found for this user.</p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Edit Product for User</h2>
          {userId && <ProductForm userId={userId} />}
        </div>
      </div>
    </div>
  );
}
