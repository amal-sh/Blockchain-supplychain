// /pages/api/upload-image.js
import { connectToDatabase } from '../../lib/mongodb';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const config = {
    api: {
        bodyParser: false, // Disable default body parser to handle raw binary image stream
    },
};

export default async function handler(req, res) {
    if (req.method === 'GET') {
        return res.status(200).json({
            message: 'This endpoint is for uploading images via POST. To view uploaded images, navigate to http://localhost:3000/uploads/<image-hash>.jpg'
        });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const reportedHash = req.headers['x-image-hash'];

        // Collect the binary chunks from request body
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        const buffer = Buffer.concat(chunks);

        if (buffer.length === 0) {
            return res.status(400).json({ message: 'No image payload found' });
        }

        // Calculate actual hash to verify data integrity
        const calculatedHash = crypto.createHash('sha256').update(buffer).digest('hex');

        // Compare provided hash from Arduino to calculated hash
        const isMatch = reportedHash ? (calculatedHash === reportedHash) : null;

        // Save the image to the public/uploads directory
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        // Ensure directory exists
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const fileName = `${calculatedHash}.jpg`;
        const filePath = path.join(uploadsDir, fileName);

        // Save the binary stream as a .jpg file
        fs.writeFileSync(filePath, buffer);

        // Store hash data in the MongoDB tracking collection along with the imagePath
        const { db } = await connectToDatabase('signup');
        const result = await db.collection('image_hashes').insertOne({
            reportedHash: reportedHash || 'None provided',
            calculatedHash,
            isMatch,
            sizeBytes: buffer.length,
            imagePath: `/uploads/${fileName}`,
            timestamp: new Date()
        });

        console.log(`[Upload-Image] Received. Size: ${buffer.length}b, Saved to ${filePath}`);

        return res.status(200).json({
            message: 'Image uploaded and hash stored successfully',
            reportedHash,
            calculatedHash,
            isMatch,
            imageUrl: `http://${req.headers.host}/uploads/${fileName}`,
            insertedId: result.insertedId
        });

    } catch (error) {
        console.error('Error handling image upload:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
