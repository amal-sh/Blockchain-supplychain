import jwt from 'jsonwebtoken';
import { connectToDatabase } from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { db } = await connectToDatabase();


    const user = await db.collection('users').findOne({ _id: new ObjectId(decoded._id) });

    if (!user) return res.status(404).json({ message: 'User not found' });

    const { password, ...userData } = user;
    console.log("User Data:", JSON.parse(JSON.stringify(userData)));
    res.status(200).json({ user: userData });
  } catch (err) {
    console.error('JWT Error:', err.message); // helpful for debugging
    return res.status(401).json({ message: 'Invalid token' });
  }
}
