// pages/api/farmer/farms.js
import { connectToDatabase } from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  try {
    // Verify the token and get the user's ID
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded._id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }

    const { db } = await connectToDatabase('signup');

    // Find all farms where the farmerId matches the logged-in user's ID
    const farms = await db.collection('farms').find({ 
      farmerId: new ObjectId(userId) 
    }).toArray();
    
    res.status(200).json({ farms });

  } catch (error) {
    console.error("API Error fetching farmer's farms:", error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
}