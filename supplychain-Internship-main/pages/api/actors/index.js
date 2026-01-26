// pages/api/actors/index.js
import { connectToDatabase } from '../../../lib/mongodb';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { db } = await connectToDatabase('signup');

    const shippableRoles = [
      'Collection Point',
      'Warehouse',
      'Processing Unit',
      'Retailer'
    ];

    const actors = await db.collection('users').find({
      role: { $in: shippableRoles },
      wallet: { $exists: true, $ne: '' }
    }, {
      // --- FIX: Add _id to the projection ---
      projection: {
        _id: 1, // This will ensure a unique key is available
        name: 1,
        role: 1,
        wallet: 1,
      }
    }).toArray();
    
    res.status(200).json({ actors });

  } catch (error) {
    console.error("API Error fetching actors:", error);
    res.status(500).json({ message: 'Internal server error' });
  }
}