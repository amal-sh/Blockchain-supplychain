import nextConnect from 'next-connect';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

// --- Multer setup (no changes here) ---
const uploadDir = path.join(process.cwd(), 'public/uploads'); 
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});
const upload = multer({ storage });
// --- End Multer setup ---

const handler = nextConnect({
  onError(error, req, res) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Something went wrong!' });
  },
  onNoMatch(req, res) {
    res.status(405).json({ error: `Method '${req.method}' Not Allowed` });
  },
});
 
handler.use(upload.array('certificates'));

handler.post(async (req, res) => {
  try {
    const { farmerId, /* ...other fields... */ } = req.body;

    if (!farmerId) {
      return res.status(400).json({ message: "Farmer ID is missing. User must be logged in." });
    }

    const uploadedFilePaths = req.files.map((file) => `/uploads/${file.filename}`);
    
    // THIS IS THE CHANGE: Connect to the 'admin' database now
    const { db } = await connectToDatabase('signup');
    const newFarm = {
      farmerId: new ObjectId(farmerId),
      farmName: req.body.farmName,
      farmingType: req.body.farmingType,
      farmDescription: req.body.farmDescription,
      country: req.body.country,
      region: req.body.region,
      address: req.body.address,
      coordinates: req.body.coordinates,
      walletAddress: req.body.walletAddress,
      organicCertified: req.body.organicCertified === 'true',
      fairtradeCertified: req.body.fairtradeCertified === 'true',
      otherCertification: req.body.otherCertification === 'true',
      certificationDetails: req.body.certificationDetails,
      dataSharing: req.body.dataSharing,
      termsAgreement: req.body.termsAgreement === 'true',
      certificateFiles: uploadedFilePaths,
      createdAt: new Date(),
      approval: 'pending',
      note: ''
    };

    const result = await db.collection('farms').insertOne(newFarm);

    res.status(200).json({
      message: 'Farm registered successfully!',
      id: result.insertedId,
    });
  } catch (error) {
    console.error('Farm registration error:', error);
    if (error.message.includes("Argument passed in must be a string")) {
      return res.status(400).json({ message: "Invalid Farmer ID format." });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

export const config = {
  api: {
    bodyParser: false, 
  },
};

export default handler;