"use client"
import Link from "next/link"
import { useState, useEffect, useMemo } from "react"
import {
  CheckCircle, XCircle, Clock, Eye, Search, Download, Mail, Phone, MapPin, Calendar, User, Building, Leaf, FileText, AlertTriangle, CheckCheck, X, Filter, Loader2
} from "lucide-react"
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { ethers } from "ethers";
import { contractAddress, supplyChainAbi } from "../../lib/contract-config";

export default function AdminPage() {
  const [registrations, setRegistrations] = useState([]);
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [isDeclineDialogOpen, setIsDeclineDialogOpen] = useState(false);
  const [selectedForDecline, setSelectedForDecline] = useState(null);
  const [isApproving, setIsApproving] = useState(null); // Tracks the ID of the farm being approved
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();

  const fetchFarms = async () => {
    try {
      const res = await fetch('/api/register-admin', { cache: 'no-store' }); 
      if (res.ok) {
        const data = await res.json();
        setRegistrations(data.farms || []); 
      } else {
        console.error("Failed to fetch farms");
      }
    } catch (error) {
      console.error("Error fetching farms:", error);
    }
  };

  useEffect(() => {
    fetchFarms();
  }, []);

  const handleApprove = async (farm) => {
    if (!farm.walletAddress || !farm.farmerDetails?.name || !farm.farmerDetails?.Phone || !farm.coordinates) {
      alert("Error: Missing required farm details (wallet, name, phone, or coordinates) for blockchain registration.");
      return;
    }
    
    setIsApproving(farm._id); // Start loading spinner for this specific farm
    
    try {
      // Step 1: Trigger blockchain transaction from Admin's wallet
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const supplyChainContract = new ethers.Contract(contractAddress, supplyChainAbi, signer);

      alert("Please confirm the transaction in your wallet to approve and register the farm on the blockchain.");
      
      const tx = await supplyChainContract.addFarmAndProfile(
        farm.walletAddress,
        farm.farmerDetails.name,
        farm.farmerDetails.Phone,
        farm.coordinates
      );
      
      await tx.wait();
      alert("Blockchain transaction successful! Farm has been registered.");

      // Step 2: Update the database status to 'approved'
      await updateStatus(farm._id, "approved");

    } catch (err) {
      console.error("Approval Error:", err);
      let errorMessage = "An error occurred during the approval process.";
      if (err.code === 'ACTION_REJECTED') {
        errorMessage = "You rejected the transaction in your wallet.";
      } else if (err.message?.includes("already registered")) {
        errorMessage = "This farm's wallet address is already registered. You may still approve it in the database if this is intended.";
        // Optionally, still update the DB if the on-chain part fails because it's already there
        await updateStatus(farm._id, "approved");
      }
      alert(errorMessage);
    } finally {
      setIsApproving(null); // Stop loading spinner
      if (isDetailModalOpen) {
        setIsDetailModalOpen(false);
      }
    }
  };

  const updateStatus = async (id, status, note = "") => {
    try {
      const res = await fetch("/api/register-admin", {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, note }),
      });
      if (res.ok) {
        fetchFarms(); // Re-fetch data to reflect changes
      } else {
        alert("Error updating database status.");
      }
    } catch (error) {
      console.error("Error in updateStatus:", error);
      alert("A client-side error occurred while updating the database.");
    }
  };

  const handleDecline = (id, reason) => {
    if (!reason.trim()) {
      alert("Decline reason cannot be empty.");
      return;
    }
    updateStatus(id, "declined", reason);
    setDeclineReason("");
    setIsDeclineDialogOpen(false);
    setSelectedForDecline(null);
  };

  const filteredRegistrations = useMemo(() => {
    return registrations
      .filter(reg => statusFilter === "all" || reg.approval === statusFilter)
      .filter(reg => {
        const term = searchTerm.toLowerCase();
        if (!term) return true;
        return (
          reg.farmerDetails?.name?.toLowerCase().includes(term) ||
          reg.farmerDetails?.email?.toLowerCase().includes(term) ||
          reg.farmName?.toLowerCase().includes(term) ||
          `${reg.address} ${reg.region} ${reg.country}`.toLowerCase().includes(term)
        );
      });
  }, [registrations, searchTerm, statusFilter]);

  const getStatusBadge = (status) => {
    const base = "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium";
    const colors = {
      approved: "bg-green-100 text-green-800",
      declined: "bg-red-100 text-red-800",
      pending: "bg-yellow-100 text-yellow-800",
    };
    const icons = {
      approved: <CheckCircle className="w-3 h-3" />,
      declined: <XCircle className="w-3 h-3" />,
      pending: <Clock className="w-3 h-3" />,
    };
    return <span className={`${base} ${colors[status] || "bg-gray-100 text-gray-800"}`}>{icons[status]}{status}</span>;
  };

  const getStatusCount = (value) => registrations.filter(reg => reg.approval === value).length;

  if (authLoading) return <div className="flex justify-center items-center min-h-screen text-lg font-semibold">Loading Dashboard...</div>;
  if (!user) return <div className="flex flex-col justify-center items-center min-h-screen text-center"><p className="text-xl mb-4">You are not logged in.</p><Link href="/" className="bg-green-600 text-white hover:bg-green-700 rounded-full px-8 py-3 font-semibold">Home</Link></div>;
  if (user.role !== "Admin") return <div className="flex flex-col justify-center items-center min-h-screen text-center"><p className="text-xl mb-4">Access Denied</p><p className="text-gray-600 mb-6">Your role (<strong>{user.role}</strong>) does not have permission to access this dashboard.</p><Link href="/" className="bg-blue-600 text-white hover:bg-blue-700 rounded-full px-8 py-3 font-semibold">Go Back Home</Link></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="w-full py-4 px-6 bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-green-600 rounded-full p-1"><Leaf className="w-6 h-6 text-white"/></div>
            <span className="font-bold text-lg">Innovest AgriChain</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-gray-700 font-medium">Admin: {user.name}</span>
            <button onClick={logout} className="p-2 bg-red-500 text-white rounded-md hover:bg-red-600">Logout</button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Total Registrations</p><p className="text-3xl font-bold text-gray-900 mt-2">{registrations.length}</p></div><div className="p-3 bg-blue-100 rounded-lg"><Building className="h-6 w-6 text-blue-600" /></div></div></div>
            <div className="bg-white rounded-xl shadow-sm p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Pending Review</p><p className="text-3xl font-bold text-yellow-600 mt-2">{getStatusCount("pending")}</p></div><div className="p-3 bg-yellow-100 rounded-lg"><Clock className="h-6 w-6 text-yellow-600" /></div></div></div>
            <div className="bg-white rounded-xl shadow-sm p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Approved</p><p className="text-3xl font-bold text-green-600 mt-2">{getStatusCount("approved")}</p></div><div className="p-3 bg-green-100 rounded-lg"><CheckCircle className="h-6 w-6 text-green-600" /></div></div></div>
            <div className="bg-white rounded-xl shadow-sm p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Declined</p><p className="text-3xl font-bold text-red-600 mt-2">{getStatusCount("declined")}</p></div><div className="p-3 bg-red-100 rounded-lg"><XCircle className="h-6 w-6 text-red-600" /></div></div></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><input type="text" placeholder="Search applications..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg" /></div></div>
            <div className="relative"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full sm:w-auto appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8"><option value="all">All Statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="declined">Declined</option></select><Filter className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" /></div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Farm Details</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRegistrations.map((reg) => (
                  <tr key={reg._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4"><div className="text-sm font-medium text-gray-900">{reg.farmName}</div><div className="text-sm text-gray-500">{reg.address}, {reg.region}</div></td>
                    <td className="px-6 py-4"><div className="text-sm font-medium text-gray-900">{reg.farmerDetails?.name || "N/A"}</div><div className="text-sm text-gray-500">{reg.farmerDetails?.email || "N/A"}</div></td>
                    <td className="px-6 py-4">{getStatusBadge(reg.approval)}</td>
                    <td className="px-6 py-4"><div className="flex items-center gap-2">
                      <button onClick={() => { setSelectedRegistration(reg); setIsDetailModalOpen(true); }} className="p-2 text-gray-600 hover:bg-gray-100 rounded-md"><Eye className="w-4 h-4" /></button>
                      {reg.approval === "pending" && (
                        <>
                          <button onClick={() => handleApprove(reg)} disabled={isApproving === reg._id} className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-300">
                            {isApproving === reg._id ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <CheckCheck className="w-4 h-4 mr-1"/>}Approve
                          </button>
                          <button onClick={() => { setSelectedForDecline(reg); setIsDeclineDialogOpen(true); }} className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-700"><X className="w-4 h-4 mr-1" />Decline</button>
                        </>
                      )}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {isDetailModalOpen && selectedRegistration && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-gray-900">Owner Information</h3>
                            <p><strong>Name:</strong> {selectedRegistration.farmerDetails?.name}</p>
                            <p><strong>Email:</strong> {selectedRegistration.farmerDetails?.email}</p>
                            <p><strong>Phone:</strong> {selectedRegistration.farmerDetails?.Phone}</p>
                            <p className="break-all"><strong>Wallet:</strong> {selectedRegistration.walletAddress}</p>
                        </div>
                        <div className="space-y-3">
                             <h3 className="text-lg font-semibold text-gray-900">Farm Information</h3>
                            <p><strong>Farm Name:</strong> {selectedRegistration.farmName}</p>
                            <p><strong>Location:</strong> {selectedRegistration.address}, {selectedRegistration.region}, {selectedRegistration.country}</p>
                            <p><strong>Coordinates:</strong> {selectedRegistration.coordinates}</p>
                            <p><strong>Registered:</strong> {new Date(selectedRegistration.createdAt).toLocaleString()}</p>
                        </div>
                        <div className="md:col-span-2">
                             <h3 className="text-lg font-semibold text-gray-900">Documents</h3>
                            {selectedRegistration.certificateFiles?.length > 0 ? selectedRegistration.certificateFiles.map((doc, index) => (
                                <a key={index} href={doc} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{doc.split('/').pop()}</a>
                            )) : <p>No documents.</p>}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 p-6 border-t">
                    {selectedRegistration.approval === "pending" && (
                        <>
                            <button onClick={() => handleApprove(selectedRegistration)} disabled={isApproving === selectedRegistration._id} className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-300">
                                {isApproving === selectedRegistration._id ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <CheckCheck className="w-4 h-4 mr-2"/>}
                                Approve Farm
                            </button>
                            <button onClick={() => { setSelectedForDecline(selectedRegistration); setIsDeclineDialogOpen(true); setIsDetailModalOpen(false); }} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700">Decline</button>
                        </>
                    )}
                    <button onClick={() => setIsDetailModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-medium bg-white hover:bg-gray-50">Close</button>
                </div>
            </div>
          </div>
      )}
      
      {isDeclineDialogOpen && selectedForDecline && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                <div className="p-6">
                    <h3 className="text-lg font-semibold">Decline Registration</h3>
                    <textarea rows={4} placeholder="Reason for decline..." value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} className="w-full mt-4 p-2 border rounded-lg"/>
                </div>
                <div className="px-6 py-4 border-t flex justify-end gap-3">
                    <button onClick={() => setIsDeclineDialogOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium bg-white hover:bg-gray-50 border">Cancel</button>
                    <button onClick={() => handleDecline(selectedForDecline._id, declineReason)} disabled={!declineReason.trim()} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">Confirm Decline</button>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}