// /pages/api/farm-images.js
import { connectToDatabase } from '../../lib/mongodb';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { db } = await connectToDatabase('signup');

        // Fetch recent image hashes, sorted by newest first
        const images = await db.collection('image_hashes')
            .find({})
            .sort({ timestamp: -1 })
            .limit(50)
            .toArray();

        return res.status(200).json(images);

    } catch (error) {
        console.error('Error fetching farm images:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
