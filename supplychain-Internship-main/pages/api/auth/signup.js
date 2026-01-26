import { connectToDatabase } from "../../../lib/mongodb";
import bcrypt from 'bcrypt';

export default async function handler(req, res) {
  const { db } = await connectToDatabase("signup");

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // CHANGE 1: Destructure the new locationCoordinates field from the request body.
  const { name, email, password, role, Phone, wallet, locationCoordinates } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  
  // Note: Hashing is commented out in your original file, keeping it that way.
  // const hashedPassword = await bcrypt.hash(password, 10);
  console.log("Registering user with role:", role);

  try {
    const existingUser = await db.collection("users").findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
        
    // CHANGE 2: Include locationCoordinates in the object being inserted into the database.
    await db.collection("users").insertOne({ 
      name, 
      email, 
      password, // Should be hashedPassword in production
      role, 
      Phone, 
      wallet, 
      locationCoordinates // This field is now included
    });

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error("Signup API Error:", err);
    res.status(500).json({ message: 'Internal server error' });
  }
}