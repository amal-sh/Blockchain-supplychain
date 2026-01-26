import { connectToDatabase } from '../../../lib/mongodb';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { walletAddress } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ message: 'Wallet address is required' });
  }

  const { db } = await connectToDatabase("signup");
  
  // Find a user whose 'wallet' field matches, case-insensitively
  const user = await db.collection("users").findOne({ 
    wallet: { $regex: new RegExp(`^${walletAddress}$`, 'i') } 
  });

  if (!user) {
    return res.status(404).json({ message: 'No registered user found for this wallet address' });
  }

  // Create a JWT token
  const token = jwt.sign(
    { _id: user._id.toString(), name: user.name, role: user.role, address: user.wallet },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Set the token in an HTTP-only cookie
  const cookie = serialize('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  res.setHeader('Set-Cookie', cookie);
  res.status(200).json({ message: 'Login successful' });
}