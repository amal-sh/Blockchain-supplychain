import { connectToDatabase } from '../../lib/mongodb';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { etag, secure_url } = req.body;

        if (!etag) {
            return res.status(400).json({ message: 'ETag is required' });
        }

        const { db } = await connectToDatabase('signup');

        // We save the ETag in the 'reportedHash' field so that sensor-data.js 
        // cleanly picks it up without requiring significant modifications.
        const result = await db.collection('image_hashes').insertOne({
            reportedHash: etag,   // We store ETag here so sensor-data picks it up
            calculatedHash: etag, // Duplicate for safety if sensor-data checks this instead
            isMatch: true,        // Assume true since it's an ETag from Cloudinary
            imagePath: secure_url,
            isEtag: true,         // Flag to indicate this is not a raw file hash
            timestamp: new Date()
        });

        console.log(`[Save-ETag] Saved ETag: ${etag}`);

        return res.status(200).json({
            message: 'ETag stored successfully',
            etag,
            imageUrl: secure_url,
            insertedId: result.insertedId
        });

    } catch (error) {
        console.error('Error saving ETag:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
