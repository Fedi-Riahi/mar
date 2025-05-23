
import { Inter } from 'next/font/google';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './api/auth/[...nextauth]/route';
import Link from 'next/link';
import  SessionContext  from './SessionContext';
import { CartProvider } from '@/lib/CartContext';
const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'E-Commerce App',
  description: 'A Next.js e-commerce application',
};

export default async function RootLayout({ children }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body className={inter.className}>
        <CartProvider>

        <SessionContext session={session}>
          <nav className="bg-blue-600 text-white p-4">
            <div className="container flex justify-between items-center">
              <Link href="/" className="text-xl font-bold">
                E-Commerce
              </Link>
              <div className="space-x-4">
                {session ? (
                    <>
                    {session.user.role === 'ADMIN' && (
                        <Link href="/admin" className="hover:underline">
                        Admin Dashboard
                      </Link>
                    )}
                    <form
                      action="/api/auth/signout"
                      method="POST"
                      className="inline"
                      >
                      <button type="submit" className="hover:underline">
                        Sign Out
                      </button>
                    </form>
                  </>
                ) : (
                    <>
                    <Link href="/signin" className="hover:underline">
                      Sign In
                    </Link>
                    <Link href="/signup" className="hover:underline">
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
            </div>
          </nav>
          {children}
        </SessionContext>
                </CartProvider>
      </body>
    </html>
  );
}
