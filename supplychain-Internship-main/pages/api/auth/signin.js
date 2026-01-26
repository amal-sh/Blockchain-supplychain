import { connectToDatabase } from '../../../lib/mongodb';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { email, password , role } = req.body;

      const { db } = await connectToDatabase("signup");
  
  const user = await db.collection("users").findOne({ email });

  if (!user || !password) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
    if (role!=user.role) {
    return res.status(401).json({ message: 'User not in this role' });
  }

  const token = jwt.sign(
    { _id: user._id.toString(),name:user.name, role: user.role , address:user.wallet },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

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
