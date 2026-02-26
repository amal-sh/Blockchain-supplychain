import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { ethers } from 'ethers';
// Make sure this file exists and exports these variables
import { contractAddress, supplyChainAbi } from '../../lib/contract-config';

// --- CONFIGURATION & HELPERS ---

// Threshold Configuration
const THRESHOLDS = {
  temperature: {
    alert: 36,
    severe: 38
  },
  humidity: {
    low: 40,
    fungalRisk: 92
  },
  soil: {
    dry: 18,
    paddyDry: 45
  },
  rain: {
    cropRisk: 50,
    flood: 150
  }
};

// Helper: Check if sensor values breach thresholds
function checkThresholds(temperature, humidity, soil, rain) {
  const alerts = [];

  // Temperature checks
  if (temperature > THRESHOLDS.temperature.severe) {
    alerts.push({
      sensorType: 'Temperature',
      sensorValue: `${temperature}°C (SEVERE)`,
      severity: 'severe'
    });
  } else if (temperature > THRESHOLDS.temperature.alert) {
    alerts.push({
      sensorType: 'Temperature',
      sensorValue: `${temperature}°C (ALERT)`,
      severity: 'alert'
    });
  }

  // Humidity checks
  if (humidity < THRESHOLDS.humidity.low) {
    alerts.push({
      sensorType: 'Humidity',
      sensorValue: `${humidity}% (LOW - Dry conditions)`,
      severity: 'alert'
    });
  } else if (humidity > THRESHOLDS.humidity.fungalRisk) {
    alerts.push({
      sensorType: 'Humidity',
      sensorValue: `${humidity}% (HIGH - Fungal risk)`,
      severity: 'alert'
    });
  }

  // Soil moisture checks
  if (soil < THRESHOLDS.soil.dry) {
    alerts.push({
      sensorType: 'Soil Moisture',
      sensorValue: `${soil}% (DRY - Irrigation needed)`,
      severity: 'alert'
    });
  }

  // Rain checks
  if (rain > THRESHOLDS.rain.flood) {
    alerts.push({
      sensorType: 'Rain',
      sensorValue: `${rain}mm (FLOOD RISK)`,
      severity: 'severe'
    });
  } else if (rain > THRESHOLDS.rain.cropRisk) {
    alerts.push({
      sensorType: 'Rain',
      sensorValue: `${rain}mm (Crop risk - excessive rain)`,
      severity: 'alert'
    });
  }

  return alerts;
}

// Helper: Write threshold breach to blockchain using service account
async function writeToBlockchain(farmWalletAddress, sensorType, sensorValue) {
  try {
    // Setup provider and signer using SERVICE ACCOUNT private key
    // Ensure these ENV variables are set in your .env.local file
    const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL || "http://localhost:8545");
    const signer = new ethers.Wallet(process.env.SENSOR_SERVICE_PRIVATE_KEY, provider);

    // Create contract instance
    const contract = new ethers.Contract(contractAddress, supplyChainAbi, signer);

    // Call fileInsuranceClaimFor function (service account files on behalf of farm)
    console.log(`Filing insurance claim on blockchain for farm ${farmWalletAddress}`);
    console.log(`Sensor: ${sensorType}, Value: ${sensorValue}`);

    const tx = await contract.fileInsuranceClaimFor(
      farmWalletAddress,
      sensorType,
      sensorValue
    );

    // Wait for transaction to be mined
    const receipt = await tx.wait();

    console.log(`✅ Blockchain transaction successful! Hash: ${receipt.hash}`);
    return { success: true, txHash: receipt.hash };

  } catch (error) {
    console.error('❌ Blockchain write failed:', error.message);
    return { success: false, error: error.message };
  }
}

// --- MAIN API HANDLER ---

export default async function handler(req, res) {
  const { db } = await connectToDatabase("signup");

  // --- POST METHOD: SAVE DATA & CHECK THRESHOLDS ---
  if (req.method === 'POST') {
    const { temperature, humidity, soil, rain, farmId } = req.body;

    // Validation
    if (
      temperature === undefined ||
      humidity === undefined ||
      soil === undefined ||
      rain === undefined
    ) {
      return res.status(400).json({ message: 'Missing sensor data fields' });
    }

    if (!farmId) {
      return res.status(400).json({ message: 'farmId is required' });
    }

    // Create Entry
    const entry = {
      temperature: Number(temperature),
      humidity: Number(humidity),
      soil: Number(soil),
      rain: Number(rain),
      timestamp: new Date(),
      farmId: new ObjectId(farmId),
    };

    try {
      // 1. Save to MongoDB (Priority)
      const result = await db.collection('sensorData').insertOne(entry);
      console.log(`✅ Sensor data saved to MongoDB: ${result.insertedId}`);

      // 2. Check Thresholds
      const alerts = checkThresholds(temperature, humidity, soil, rain);

      const blockchainResults = [];

      // 3. Handle Alerts & Blockchain Interaction
      if (alerts.length > 0) {
        console.log(`⚠️ ${alerts.length} threshold breach(es) detected!`);

        // Get farm wallet address from database
        const farm = await db.collection('farms').findOne({ _id: new ObjectId(farmId) });

        if (!farm || !farm.walletAddress) {
          console.error('❌ Farm wallet address not found in database');
          return res.status(200).json({
            message: 'Data received successfully',
            id: result.insertedId,
            alerts: alerts,
            blockchainWarning: 'Farm wallet address not found - could not write to blockchain'
          });
        }

        // Verify farm is registered on-chain (Optional safety check)
        try {
          const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL || "http://localhost:8545");
          // Use provider here for read-only check
          const contract = new ethers.Contract(contractAddress, supplyChainAbi, provider);
          const farmRole = await contract.roles(farm.walletAddress);

          if (farmRole !== 2n) { // 2n is Role.FARM in Solidity
            console.error(`❌ Farm ${farm.walletAddress} is not registered on-chain`);
            return res.status(200).json({
              message: 'Data received successfully',
              id: result.insertedId,
              alerts: alerts,
              blockchainWarning: 'Farm is not registered on-chain - could not write to blockchain'
            });
          }
        } catch (roleCheckError) {
          console.error('❌ Failed to verify farm registration:', roleCheckError.message);
          // We continue despite this error to attempt the write, or you could return here.
        }

        // Write each alert to blockchain
        for (const alert of alerts) {
          const blockchainResult = await writeToBlockchain(
            farm.walletAddress,
            alert.sensorType,
            alert.sensorValue
          );
          blockchainResults.push({
            ...alert,
            blockchain: blockchainResult
          });
        }
      }

      // Return success with details about alerts/blockchain
      return res.status(200).json({
        message: 'Data received successfully',
        id: result.insertedId,
        alerts: alerts.length > 0 ? alerts : undefined,
        blockchainRecords: blockchainResults.length > 0 ? blockchainResults : undefined
      });

    } catch (error) {
      console.error('Failed to process sensor data:', error);
      return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
  }

  // --- GET METHOD: FETCH DATA ---
  if (req.method === 'GET') {
    const { farmId } = req.query;

    if (!farmId) {
      return res.status(400).json({ message: 'Farm ID is required' });
    }

    try {
      let data = await db
        .collection('sensorData')
        .find({ farmId: new ObjectId(farmId) })
        .sort({ timestamp: -1 })
        .limit(100)
        .toArray();

      if (data.length === 0) {
        data = await db
          .collection('sensorData')
          .find({ farmId: farmId })
          .sort({ timestamp: -1 })
          .limit(100)
          .toArray();
      }

      const formattedData = data.map(entry => ({
        ...entry,
        timestamp: entry.timestamp.toISOString(),
      })).reverse();

      return res.status(200).json(formattedData);
    } catch (error) {
      console.error('Failed to fetch sensor data:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  res.setHeader('Allow', ['POST', 'GET']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}