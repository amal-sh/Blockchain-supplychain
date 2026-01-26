"use client"
import Link from "next/link";
import { ethers } from "ethers";
import Footer from "../../components/Footer/page";
import { useState, useEffect, useMemo,useRef } from "react";
import { useAuth } from '../../context/AuthContext';
import { Leaf, LogOut, Wallet, PlusCircle, Package, Truck, Loader2, PackagePlus, Search, X, ArrowRight, Warehouse, Building, ShoppingBasket, Factory, QrCode, CheckCircle as CheckCircleIcon, Shield } from "lucide-react";
import { useRouter } from 'next/navigation';
import { contractAddress, supplyChainAbi } from "../../lib/contract-config";
import QRCode from 'qrcode';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import GraphBlock from '../../components/Graphblock/page';

export default function FarmerDashboard() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();

      const [dataPoints, setDataPoints] = useState([]);

  // State for farm and product data
  const [userFarms, setUserFarms] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [isLoadingFarms, setIsLoadingFarms] = useState(true);
  const [allProducts, setAllProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [activeTab, setActiveTab] = useState('myProducts');
  const [actorMap, setActorMap] = useState(new Map());

  // State for modals
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isShipModalOpen, setIsShipModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // State for modal data
  const [productToShip, setProductToShip] = useState(null);
  const [newProduct, setNewProduct] = useState({ name: '', quantity: '', unit: 'kg' });
  const [shipmentDetails, setShipmentDetails] = useState({ quantity: '' });
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [qrProductName, setQrProductName] = useState('');

  // State for shipping UI
  const [destinationRole, setDestinationRole] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActor, setSelectedActor] = useState(null);
  
  // State for async operations and messages
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: "", isError: false });
  
  // Static data
  const units = ['g', 'kg', 'quintal', 'tonne'];
  const shippableRoles = ['Collection Point', 'Warehouse', 'Processing Unit', 'Retailer'];
    const [liveData, setLiveData] = useState([]);

const [sensorData, setSensorData] = useState([]);


 const latestTimestampRef = useRef(null); // Keeps track of last timestamp

  useEffect(() => {
    if (user && user._id) {
      console.log("User found, fetching data for farmId:", user._id); // Log user ID
      const fetchSensorData = async () => {
        try {
          const res = await fetch(`/api/sensor-data?farmId=${user._id}`);
          if (!res.ok) {
            throw new Error(`Data could not be fetched! Status: ${res.status}`);
          }
          const newData = await res.json();
          console.log("Received sensor data:", newData); // Log received data
          setSensorData(newData);
        } catch (error) {
          console.error("Failed to fetch sensor data:", error);
          setSensorData([]); // Clear data on error
        }
      };

      fetchSensorData();
      const intervalId = setInterval(fetchSensorData, 5000); // 5 seconds

      return () => clearInterval(intervalId);
    } else {
      console.log("User not available or missing ID, skipping data fetch."); // Log if user is not ready
    }
  }, [user]);

  // Chart.js data
  const chartData = {
    labels: liveData.map((d) => new Date(d.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'Temperature (°C)',
        data: liveData.map((d) => d.temperature),
        borderColor: 'rgba(255, 99, 132, 1)',
        fill: false,
        tension: 0.3,
        pointRadius: 0,
      },
      {
        label: 'Humidity (%)',
        data: liveData.map((d) => d.humidity),
        borderColor: 'rgba(54, 162, 235, 1)',
        fill: false,
        tension: 0.3,
        pointRadius: 0,
      },
      {
        label: 'Soil Moisture',
        data: liveData.map((d) => d.soil),
        borderColor: 'rgba(34, 197, 94, 1)',
        fill: false,
        tension: 0.3,
        pointRadius: 0,
      },
      {
        label: 'Rain',
        data: liveData.map((d) => d.rain),
        borderColor: 'rgba(129, 140, 248, 1)',
        fill: false,
        tension: 0.3,
        pointRadius: 0,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
    },
    scales: {
      x: {
        ticks: {
          autoSkip: true,
          maxTicksLimit: 10,
        },
      },
      y: {
        beginAtZero: true,
      },
    },
  };


  
  // Fetch user's registered farms from the backend
  useEffect(() => {
    if (user) {
      const fetchUserFarms = async () => {
        setIsLoadingFarms(true);
        try {
          const res = await fetch('/api/farmer/farms');
          if (res.ok) { setUserFarms((await res.json()).farms || []); }
        } catch (error) { console.error("Error fetching farms:", error); } 
        finally { setIsLoadingFarms(false); }
      };
      fetchUserFarms();
    }
  }, [user]);
  
  const approvedFarms = useMemo(() => userFarms.filter(farm => farm.approval === 'approved'), [userFarms]);

  // Handle wallet connection and farm selection
  const handleSelectFarm = async () => {
    setStatusMessage({ text: "", isError: false });
    try {
        if (typeof window.ethereum === 'undefined') throw new Error("Please install MetaMask!");
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        const connectedAddress = ethers.getAddress(accounts[0]);
        const farm = approvedFarms.find(f => ethers.getAddress(f.walletAddress) === connectedAddress);
        if (farm) { setSelectedFarm(farm); } 
        else { setStatusMessage({ text: "The connected wallet does not match any of your approved farms.", isError: true }); }
    } catch (err) { setStatusMessage({ text: err.message || "Failed to connect wallet.", isError: true }); }
  };

  // Fetch all product data from the blockchain once a farm is selected
  useEffect(() => {
    const fetchBlockchainData = async () => {
        if (!selectedFarm) return;
        setIsLoadingProducts(true);
        setStatusMessage({ text: "", isError: false });
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const contract = new ethers.Contract(contractAddress, supplyChainAbi, provider);
            
            const actorRes = await fetch('/api/actors');
            if (actorRes.ok) {
                const { actors } = await actorRes.json();
                const newActorMap = new Map();
                actors.forEach(actor => newActorMap.set(ethers.getAddress(actor.wallet), { name: actor.name, role: actor.role, _id: actor._id }));
                setActorMap(newActorMap);
            }

            const productCount = Number(await contract.productCounter());
            const productPromises = Array.from({ length: productCount }, (_, i) => contract.getProduct(i));
            const products = await Promise.all(productPromises);
            setAllProducts(products.reverse());
        } catch (error) {
            console.error("Failed to fetch from blockchain", error);
            setStatusMessage({ text: "Could not load data from the blockchain. Check console.", isError: true }); 
        } finally { 
            setIsLoadingProducts(false); 
        }
    };
    fetchBlockchainData();
  }, [selectedFarm]);

  // Update shipment form when a product is selected to be shipped
  useEffect(() => {
    if (productToShip) { setShipmentDetails({ quantity: productToShip.quantity.toString() }); }
  }, [productToShip]);

  // Memoized filters for actors and products
  const filteredActors = useMemo(() => {
    if (!destinationRole) return [];
    return Array.from(actorMap.values()).filter(actor => actor.role === destinationRole && actor.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [actorMap, destinationRole, searchTerm]);

  const productsAtFarm = useMemo(() => allProducts.filter(p => p && ethers.getAddress(p.currentOwner) === ethers.getAddress(selectedFarm?.walletAddress) && p.currentState.toString() === '0' && p.quantity > 0), [allProducts, selectedFarm]);
  
  const productsShipped = useMemo(() => {
      if (!selectedFarm) return {};
      const farmAddress = ethers.getAddress(selectedFarm.walletAddress);
      
      const shipped = allProducts.filter(p => 
          p && p.history.length > 0 && 
          ethers.getAddress(p.history[0].actor) === farmAddress &&
          p.currentState.toString() !== '0' // Filter out products still AT_FARM
      );

      // Group products by the date they were shipped
      const groupedByDate = shipped.reduce((acc, product) => {
        const shippedEvent = product.history.find(h => h.details.includes("Split from"));
        const date = shippedEvent ? new Date(Number(shippedEvent.timestamp) * 1000).toLocaleDateString() : 'Unknown Date';
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(product);
        return acc;
      }, {});

      return groupedByDate;
  }, [allProducts, selectedFarm]);

  

  const graphBlock = (title, color, dataKey) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border"><h3 className="text-lg font-semibold mb-4 text-gray-700">{title}</h3><div className="w-full h-[250px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={liveData}><CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" /><XAxis dataKey="timestamp" fontSize={12} tick={{ fill: '#666' }} /><YAxis domain={['dataMin - 2', 'dataMax + 2']} fontSize={12} tick={{ fill: '#666' }} /><Tooltip /><Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div></div>
  );

  // Handlers for blockchain transactions and UI events
  const handleGenerateQrCode = async (product) => {
    const url = `${window.location.origin}/scan-product?id=${product.productId.toString()}`;
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 300 });
      setQrCodeUrl(dataUrl);
      setQrProductName(product.name);
      setIsQrModalOpen(true);
    } catch (err) {
      console.error('Failed to generate QR code', err);
      setStatusMessage({ text: "Could not generate QR code.", isError: true });
    }
  };

  const handleAddProduct = async (e) => { e.preventDefault(); setIsProcessing(true); setStatusMessage({ text: "Submitting...", isError: false }); try { const provider = new ethers.BrowserProvider(window.ethereum); const signer = await provider.getSigner(); const contract = new ethers.Contract(contractAddress, supplyChainAbi, signer); const tx = await contract.createProduct(newProduct.name, ethers.parseUnits(newProduct.quantity, 0), newProduct.unit); await tx.wait(); setStatusMessage({ text: "Product created successfully!", isError: false }); setIsAddProductModalOpen(false); setNewProduct({ name: '', quantity: '', unit: 'kg' }); setTimeout(() => window.location.reload(), 2000); } catch (err) { setStatusMessage({ text: "Failed to create product. " + (err.reason || err.message), isError: true }); } finally { setIsProcessing(false); } };
  const handleShipProduct = async (e) => { e.preventDefault(); if (!selectedActor) { alert("Please select a destination."); return; } setIsProcessing(true); setStatusMessage({ text: "Submitting...", isError: false }); try { const provider = new ethers.BrowserProvider(window.ethereum); const signer = await provider.getSigner(); const contract = new ethers.Contract(contractAddress, supplyChainAbi, signer); const destinationWallet = Array.from(actorMap.entries()).find(([key, value]) => value._id === selectedActor._id)?.[0]; const tx = await contract.splitAndShip(productToShip.productId, ethers.parseUnits(shipmentDetails.quantity, 0), destinationWallet); await tx.wait(); setStatusMessage({ text: "Product shipped successfully!", isError: false }); resetShipModal(); setTimeout(() => window.location.reload(), 2000); } catch (err) { setStatusMessage({ text: "Failed to ship product. " + (err.reason || err.message), isError: true }); } finally { setIsProcessing(false); } };
  
  const resetShipModal = () => { setIsShipModalOpen(false); setProductToShip(null); setDestinationRole(''); setSearchTerm(''); setSelectedActor(null); setShipmentDetails({ quantity: '' }); };
  const formatTimestamp = (unixTimestamp) => new Date(Number(unixTimestamp) * 1000).toLocaleString();
  const getRoleIcon = (role) => { switch (role) { case 'Warehouse': return <Warehouse className="w-8 h-8 text-gray-500" />; case 'Collection Point': return <Building className="w-8 h-8 text-gray-500" />; case 'Processing Unit': return <Factory className="w-8 h-8 text-gray-500" />; case 'Retailer': return <ShoppingBasket className="w-8 h-8 text-gray-500" />; default: return <Building className="w-8 h-8 text-gray-400"/>; } };
  
  // Auth guards
  if (authLoading) return <div className="flex justify-center items-center min-h-screen"><div className="text-lg font-semibold">Loading Dashboard...</div></div>;
  if (!user) return <div className="flex flex-col justify-center items-center min-h-screen text-center"><p className="text-xl mb-4">You are not logged in.</p><Link href="/#signup" className="bg-green-600 text-white hover:bg-green-700 rounded-full px-8 py-3 font-semibold">Home</Link></div>;
  if (user.role !== "Farmer") return <div className="flex flex-col justify-center items-center min-h-screen text-center"><p className="text-xl mb-4">Access Denied</p><p className="text-gray-600 mb-6">Your role (<strong>{user.role}</strong>) does not have permission to access this dashboard.</p><Link href="/" className="bg-blue-600 text-white hover:bg-blue-700 rounded-full px-8 py-3 font-semibold">Go Back Home</Link></div>;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="w-full py-4 px-6 bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
                <Leaf className="w-7 h-7 text-green-600" />
                <span className="font-bold text-lg">AgriChain Farmer</span>
            </Link>
            <div className="flex items-center gap-4">
                <span className="hidden sm:inline text-gray-700 font-medium">Welcome, {user.name}</span>
                <button onClick={logout} className="flex items-center gap-2 p-2 bg-red-500 text-white rounded-md hover:bg-red-600">
                    <LogOut className="w-4 h-4" />Logout
                </button>
            </div>
        </div>
      </header>

      <main className="flex-grow">
        <section className="bg-green-50 py-12 md:py-20">
            <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20">
                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="md:w-1/2">
                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">Welcome, {user.name}!</h1>
                        <p className="text-lg text-gray-600 mb-6">Manage your farm's supply chain data, track shipments, and receive instant payments—all in one secure blockchain-powered platform.</p>
                        
                            <div className="flex flex-wrap gap-4">
    <Link href="/register-farm" className="bg-green-600 text-white hover:bg-green-700 rounded-full px-6 py-3 text-sm font-semibold">Register New Farm</Link>
    <a href="#farm-management" className="bg-white text-green-600 hover:bg-gray-100 rounded-full px-6 py-3 text-sm font-semibold border border-green-600">Manage Products</a>
    <Link href="/farmer/insurance-claim" className="bg-blue-600 text-white hover:bg-blue-700 rounded-full px-6 py-3 text-sm font-semibold flex items-center gap-2">
        <Shield className="w-4 h-4" />
        Insurance Claim
    </Link>
</div>
                    </div>
                    <div className="md:w-1/2">
                        <img src="https://plus.unsplash.com/premium_photo-1682125843235-8b31e5800095?q=80&w=2070&auto=format&fit=crop" alt="Farmer" className="rounded-lg shadow-lg" />
                    </div>
                </div>
            </div>
        </section>

        <section id="farm-management" className="py-12">
            <div className="max-w-7xl mx-auto px-6">
                {!selectedFarm ? (
                  <div className="bg-white p-8 rounded-xl shadow-md text-center">
                    <h2 className="text-2xl font-semibold mb-4">Select Your Farm to Begin</h2>
                    <p className="text-gray-600 mb-6">Connect your wallet to select one of your admin-approved farms.</p>
                    {isLoadingFarms ? ( 
                        <Loader2 className="animate-spin h-8 w-8 text-green-600 mx-auto" /> 
                    ) : approvedFarms.length > 0 ? (
                        <button onClick={handleSelectFarm} className="inline-flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 rounded-full px-8 py-3 font-semibold">
                            <Wallet className="w-5 h-5" />Connect & Select Farm
                        </button>
                    ) : (
                        <div className="text-center p-6 border-2 border-dashed rounded-lg">
                            <p className="text-gray-700 font-medium mb-4">You have no approved farms yet.</p>
                            <Link href="/register-farm" className="bg-blue-600 text-white hover:bg-blue-700 rounded-full px-6 py-3 text-sm font-semibold">Register a New Farm</Link>
                        </div>
                    )}
                    {statusMessage.text && <p className={`mt-4 text-sm ${statusMessage.isError ? 'text-red-600' : 'text-green-600'}`}>{statusMessage.text}</p>}
                  </div>
                ) : (
                  <div>
                    <div className="bg-white p-6 rounded-xl shadow-md mb-8">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-semibold text-green-700">{selectedFarm.farmName}</h2>
                                <p className="text-sm text-gray-500 break-all">Wallet: {selectedFarm.walletAddress}</p>
                            </div>
                            <button onClick={() => setSelectedFarm(null)} className="text-sm font-semibold text-blue-600 hover:underline">Change Farm</button>
                        </div>
                    </div>

                    <div className="mb-8">
    <h2 className="text-2xl font-bold text-gray-800 mb-4">Live Farm Conditions</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
<GraphBlock title="Temperature (°C)" color="#f87171" dataKey="temperature" data={sensorData} />
<GraphBlock title="Humidity (%)" color="#60a5fa" dataKey="humidity" data={sensorData} />
<GraphBlock title="Soil Moisture" color="#34d399" dataKey="soil" data={sensorData} />
<GraphBlock title="Rain Sensor" color="#818cf8" dataKey="rain" data={sensorData} />

    </div>
</div>

                    <div className="bg-white p-6 rounded-xl shadow-md mb-8">
                        <div className="border-b border-gray-200 mb-6">
                            <nav className="flex gap-6">
                                <button onClick={() => setActiveTab('myProducts')} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'myProducts' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Products at Farm</button>
                                <button onClick={() => setActiveTab('shipped')} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'shipped' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Shipped Products</button>
                            </nav>
                        </div>
                        <div className="flex justify-end mb-4">
                            <button onClick={() => setIsAddProductModalOpen(true)} className="inline-flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 rounded-md px-4 py-2 font-semibold text-sm">
                                <PlusCircle className="w-5 h-5"/>Add New Product
                            </button>
                        </div>
                        {statusMessage.text && <div className={`mb-4 p-3 rounded-md text-sm ${statusMessage.isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{statusMessage.text}</div>}
                        {isLoadingProducts ? (
                            <div className="text-center py-8"><Loader2 className="animate-spin h-8 w-8 text-green-600 mx-auto" /></div>
                        ) : (
                            <div>
                                {activeTab === 'myProducts' && (
                                    <div className="space-y-4">
                                        {productsAtFarm.length > 0 ? productsAtFarm.map(p => (
                                            <div key={p.productId.toString()} className="bg-gray-50 border rounded-lg p-4 flex items-center justify-between transition hover:shadow-md">
                                                <div className="flex items-center gap-4">
                                                    <Package className="w-8 h-8 text-green-600 flex-shrink-0"/>
                                                    <div className="flex-grow">
                                                        <div><span className="font-bold text-gray-800">{p.name}</span><span className="text-xs text-gray-400 ml-2">#{p.productId.toString()}</span></div>
                                                        <p className="text-sm text-gray-600">{p.quantity.toString()} {p.unit}</p>
                                                        <p className="text-xs text-gray-400 mt-1">Created: {formatTimestamp(p.history[0].timestamp)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => handleGenerateQrCode(p)} className="inline-flex items-center gap-2 bg-gray-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                                                        <QrCode className="w-4 h-4" />QR
                                                    </button>
                                                    <button onClick={() => { setProductToShip(p); setIsShipModalOpen(true); }} className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                                                        <Truck className="w-4 h-4"/>Ship
                                                    </button>
                                                </div>
                                            </div>
                                        )) : <p className="text-center py-4 text-gray-500">No available products at this farm.</p>}
                                    </div>
                                )}
                                {activeTab === 'shipped' && (
                                    <div className="space-y-6">
                                        {Object.keys(productsShipped).length > 0 ? (
                                            Object.keys(productsShipped).sort((a, b) => new Date(b) - new Date(a)).map(date => (
                                                <div key={date}>
                                                    <h3 className="text-lg font-semibold text-gray-700 mb-3">{date}</h3>
                                                    <div className="space-y-4">
                                                        {productsShipped[date].map(p => {
                                                            const destination = actorMap.get(ethers.getAddress(p.destinationAddress));
                                                            const isReceived = p.currentState.toString() !== '1';
                                                            return (
                                                                <div key={p.productId.toString()} className="bg-gray-50 border rounded-lg p-4 flex items-center justify-between">
                                                                    <div className="flex items-center gap-4 flex-grow">
                                                                        <div className="flex-shrink-0">
                                                                            {isReceived ? <Package className="w-8 h-8 text-green-600"/> : <Truck className="w-8 h-8 text-yellow-500"/>}
                                                                        </div>
                                                                        <div className="flex-grow">
                                                                            <div><span className="font-bold text-gray-800">{p.name}</span><span className="text-xs text-gray-400 ml-2">#{p.productId.toString()}</span></div>
                                                                            <p className="text-sm text-gray-600">{p.quantity.toString()} {p.unit}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="text-right">
                                                                            <p className="text-sm font-semibold text-gray-800">To: {destination?.name || 'Unknown'}</p>
                                                                            <p className="text-xs text-gray-500">{destination?.role || 'N/A'}</p>
                                                                        </div>
                                                                        {isReceived ? (
                                                                            <div className="text-xs font-semibold text-green-800 bg-green-100 px-3 py-1 rounded-full flex items-center gap-1">
                                                                                <CheckCircleIcon className="w-3 h-3"/> Received
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-xs font-semibold text-yellow-800 bg-yellow-100 px-3 py-1 rounded-full">
                                                                                In Transit
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-center py-4 text-gray-500">No products have been shipped from this farm.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                  </div>
                )}
            </div>
        </section>
      </main>

      {/* --- MODALS --- */}
      {isAddProductModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                <div className="p-6 border-b flex items-center gap-4">
                    <div className="bg-green-100 p-3 rounded-full"><PackagePlus className="w-6 h-6 text-green-600" /></div>
                    <div>
                        <h3 className="text-xl font-semibold">Create New Product Batch</h3>
                        <p className="text-sm text-gray-500">Add a new harvest to the blockchain for your farm.</p>
                    </div>
                </div>
                <form onSubmit={handleAddProduct} className="p-6 space-y-5">
                    <div>
                        <label htmlFor="productName" className="text-sm font-medium text-gray-700 block mb-1">Product Name</label>
                        <input id="productName" type="text" value={newProduct.name} onChange={(e) => setNewProduct({...newProduct, name: e.target.value})} className="w-full border-gray-300 rounded-md p-2 shadow-sm focus:ring-green-500 focus:border-green-500" placeholder="e.g., Organic Mangoes" required/>
                    </div>
                    <div>
                        <label htmlFor="quantity" className="text-sm font-medium text-gray-700 block mb-1">Quantity & Unit</label>
                        <div className="mt-1 grid grid-cols-3 gap-2">
                            <input id="quantity" type="number" value={newProduct.quantity} onChange={(e) => setNewProduct({...newProduct, quantity: e.target.value})} className="col-span-2 border-gray-300 rounded-md p-2 shadow-sm focus:ring-green-500 focus:border-green-500" placeholder="e.g., 500" required/>
                            <select value={newProduct.unit} onChange={(e) => setNewProduct({...newProduct, unit: e.target.value})} className="col-span-1 border-gray-300 rounded-md p-2 shadow-sm bg-white focus:ring-green-500 focus:border-green-500">
                                {units.map(u => (<option key={u} value={u}>{u}</option>))}
                            </select>
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end gap-3 border-t mt-6">
                        <button type="button" onClick={() => {setIsAddProductModalOpen(false); setNewProduct({ name: '', quantity: '', unit: 'kg' });}} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md text-sm font-medium hover:bg-gray-300">Cancel</button>
                        <button type="submit" disabled={isProcessing} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:bg-green-300">
                            {isProcessing && <Loader2 className="w-4 h-4 animate-spin"/>}
                            {isProcessing ? "Processing..." : "Create Product"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {isShipModalOpen && productToShip && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                <div className="p-6 border-b flex items-center gap-4">
                    <div className="bg-blue-100 p-3 rounded-full"><Truck className="w-6 h-6 text-blue-600" /></div>
                    <div>
                        <h3 className="text-xl font-semibold">Ship Product Batch #{productToShip.productId.toString()}</h3>
                        <p className="text-sm text-gray-500">Create a new shipment on the blockchain.</p>
                    </div>
                </div>
                <form onSubmit={handleShipProduct} className="p-6">
                    <div className="space-y-6">
                        <div>
                            <div className="text-sm font-medium text-gray-500">Product</div>
                            <p className="text-lg font-semibold text-gray-800">{productToShip.name}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <div className="text-sm font-medium text-gray-500">Total Available Quantity</div>
                                <p className="text-lg font-semibold text-gray-800">{productToShip.quantity.toString()} {productToShip.unit}</p>
                            </div>
                            <div>
                                <label htmlFor="shipQuantity" className="text-sm font-medium text-gray-700 block mb-1">Quantity to Ship</label>
                                <div className="flex items-center">
                                    <input id="shipQuantity" type="number" max={productToShip.quantity.toString()} value={shipmentDetails.quantity} onChange={(e) => setShipmentDetails({...shipmentDetails, quantity: e.target.value})} className="w-full border-gray-300 rounded-l-md p-2 shadow-sm focus:ring-blue-500 focus:border-blue-500" required/>
                                    <span className="inline-flex items-center px-3 text-sm text-gray-600 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md h-10">{productToShip.unit}</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="text-sm font-medium text-gray-700 block mb-1">Destination</div>
                            <div className="space-y-3 p-4 border rounded-md bg-gray-50">
                                {selectedActor ? (
                                    <div className="flex justify-between items-center">
                                        <div className="font-medium text-green-700">{selectedActor.name} <span className="text-xs text-gray-500">({selectedActor.role})</span></div>
                                        <button type="button" onClick={() => setSelectedActor(null)} className="p-1 text-red-500 hover:bg-red-100 rounded-full"><X className="w-4 h-4"/></button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label htmlFor="destRole" className="text-xs font-medium text-gray-600">Step 1: Select Type</label>
                                                <select id="destRole" value={destinationRole} onChange={(e) => {setDestinationRole(e.target.value); setSearchTerm('');}} className="w-full border-gray-300 rounded-md p-2 shadow-sm bg-white focus:ring-blue-500 focus:border-blue-500">
                                                    <option value="">-- Select Role --</option>
                                                    {shippableRoles.map(r => (<option key={r} value={r}>{r}</option>))}
                                                </select>
                                            </div>
                                            <div>
                                                <label htmlFor="destSearch" className="text-xs font-medium text-gray-600">Step 2: Search Name</label>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"/>
                                                    <input id="destSearch" type="text" placeholder="Search..." disabled={!destinationRole} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 p-2 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"/>
                                                </div>
                                            </div>
                                        </div>
                                        {destinationRole && (
                                            <div className="max-h-32 overflow-y-auto border rounded-md">
                                                {filteredActors.length > 0 ? filteredActors.map(actor => (
                                                    <div key={actor._id} onClick={() => { setSelectedActor(actor); setSearchTerm(actor.name); }} className="p-2 cursor-pointer hover:bg-blue-50 text-sm">{actor.name}</div>
                                                )) : (<p className="p-2 text-sm text-gray-500">No results found.</p>)}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="pt-6 flex justify-end gap-3 border-t mt-6">
                        <button type="button" onClick={resetShipModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md text-sm font-medium hover:bg-gray-300">Cancel</button>
                        <button type="submit" disabled={isProcessing || !selectedActor} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-blue-300">
                            {isProcessing && <Loader2 className="w-4 h-4 animate-spin"/>}
                            {isProcessing ? "Shipping..." : "Confirm & Ship"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {isQrModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm text-center p-6 relative">
             <button onClick={() => setIsQrModalOpen(false)} className="absolute top-2 right-2 text-gray-500 hover:text-gray-800">
                <X className="w-5 h-5"/>
             </button>
             <h3 className="text-xl font-semibold mb-4">QR Code for {qrProductName}</h3>
             <img src={qrCodeUrl} alt={`QR Code for ${qrProductName}`} className="mx-auto" />
             <p className="text-sm text-gray-500 mt-4">Scan this code to view the product's timeline.</p>
          </div>
        </div>
      )}
      
      <Footer />
    </div>
  );
}