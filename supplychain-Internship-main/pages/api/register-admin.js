import { ObjectId } from "mongodb";
import { connectToDatabase } from "../../lib/mongodb";

export const dynamic = 'force-dynamic';

export default async function handler(req, res) {
  const { db } = await connectToDatabase("signup"); 

  if (req.method === "GET") {
    try {
      const pipeline = [
        {
          $lookup: {
            from: "users",
            localField: "farmerId",
            foreignField: "_id",
            as: "farmerDetails"
          }
        },
        {
          $unwind: {
            path: "$farmerDetails",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $sort: { createdAt: -1 }
        }
      ];

      const result = await db.collection("farms").aggregate(pipeline).toArray();
      return res.status(200).json({
        message: "Farms fetched successfully!",
        farms: result,
      });

    } catch (error) {
      console.error("GET error in /api/register-admin:", error);
      return res.status(500).json({ message: "Internal server error", error: error.message });
    }
  }

  if (req.method === "PATCH") {
    try {
      const { id, status, note } = req.body;
      if (!id || !status) {
        return res.status(400).json({ message: "Missing 'id' or 'status'" });
      }

      const updateFields = { approval: status };
      if (status === "declined" && note) {
        updateFields.note = note;
      }

      const result = await db.collection("farms").updateOne(
        { _id: new ObjectId(id) },
        { $set: updateFields }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Farm not found" });
      }

      return res.status(200).json({ message: "Database status updated successfully" });
    } catch (error) {
      console.error("PATCH error in /api/register-admin:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}