// /pages/api/login.js
import {connectToDatabase} from '../../lib/mongodb';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  // Define valid roles and corresponding collection names
  const roleCollections = {
    farmer: 'farmer',
    warehouse: 'warehouses',
    processing: 'processing_units',
    customer: 'customers',
    admin: 'admins',
    'collection-point': 'collection_points'
  };

  const collectionName = roleCollections[role];

  if (!collectionName) {
    return res.status(400).json({ message: 'Invalid role specified' });
  }

  try {
  const { db } = await connectToDatabase('signup');

    const user = await db.collection(collectionName).findOne({ email });
    console.log("user", user);
    if (!user) {
      return res.status(404).json({ message: 'User not found in this role' });
    }

    // TODO: Use bcrypt for secure passwords in real app
    if (user.password !== password) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    // Dummy token
    const token = 'role-based-token'; // Replace with real JWT later

    res.status(200).json({ message: 'Login successful', token });
    console.log("login done successfully");
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
