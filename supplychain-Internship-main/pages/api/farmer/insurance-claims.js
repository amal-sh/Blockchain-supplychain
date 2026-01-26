// pages/api/farmer/insurance-claims.js
import { connectToDatabase } from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
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

    if (req.method === 'POST') {
      // Create new insurance claim
      const {
        farmId,
        farmName,
        claimType,
        cropType,
        affectedArea,
        damageDescription,
        estimatedLoss,
        damageDate,
        contactPhone,
        additionalInfo
      } = req.body;

      // Validate required fields
      if (!farmId || !claimType || !cropType || !affectedArea || !damageDescription || !estimatedLoss || !damageDate) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      // Verify the farm belongs to the user
      const farm = await db.collection('farms').findOne({
        _id: new ObjectId(farmId),
        farmerId: new ObjectId(userId)
      });

      if (!farm) {
        return res.status(403).json({ message: 'Farm not found or access denied' });
      }

      const newClaim = {
        farmerId: new ObjectId(userId),
        farmId: new ObjectId(farmId),
        farmName,
        claimType,
        cropType,
        affectedArea: parseFloat(affectedArea),
        damageDescription,
        estimatedLoss: parseFloat(estimatedLoss),
        damageDate: new Date(damageDate),
        contactPhone,
        additionalInfo,
        status: 'pending', // pending, under_review, approved, rejected
        claimNumber: `INS-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        submittedAt: new Date(),
        lastUpdated: new Date()
      };

      const result = await db.collection('insurance_claims').insertOne(newClaim);
      
      return res.status(201).json({ 
        message: 'Insurance claim submitted successfully',
        claimId: result.insertedId,
        claimNumber: newClaim.claimNumber
      });

    } else if (req.method === 'GET') {
      // Get all insurance claims for the user
      const claims = await db.collection('insurance_claims')
        .find({ farmerId: new ObjectId(userId) })
        .sort({ submittedAt: -1 })
        .toArray();

      return res.status(200).json({ claims });

    } else {
      return res.status(405).json({ message: 'Method not allowed' });
    }

  } catch (error) {
    console.error("API Error in insurance claims:", error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
}