"use client"
import Link from "next/link";
import { ethers } from "ethers";
import Footer from "../../components/Footer/page";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { contractAddress, supplyChainAbi } from "../../lib/contract-config";
import { Leaf, LogOut, Package, Truck, Loader2, Search, X, QrCode, CheckCircle, Store, ShoppingCart, CheckCircleIcon } from "lucide-react";
import QRCode from 'qrcode';

export default function RetailerDashboard() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();

  // State for data from blockchain
  const [allProducts, setAllProducts] = useState([]);
  const [actorMap, setActorMap] = useState(new Map());

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stock');
  const [statusMessage, setStatusMessage] = useState({ text: "", isError: false });

  // Modals State
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [productToSell, setProductToSell] = useState(null);
  const [sellDetails, setSellDetails] = useState({ quantity: '' });
  
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [qrProductName, setQrProductName] = useState('');
  
  // Async Operations State
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const fetchBlockchainData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setStatusMessage({ text: "", isError: false });
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(contractAddress, supplyChainAbi, provider);

        const actorRes = await fetch('/api/actors');
        if (actorRes.ok) {
            const { actors } = await actorRes.json();
            const newActorMap = new Map();
            actors.forEach(actor => {
                if (ethers.isAddress(actor.wallet)) {
                    newActorMap.set(ethers.getAddress(actor.wallet), { name: actor.name, role: actor.role, _id: actor._id });
                }
            });
            setActorMap(newActorMap);
        }
        
        const productCount = Number(await contract.productCounter());
        const productPromises = Array.from({ length: productCount }, (_, i) => contract.getProduct(i));
        const products = await Promise.all(productPromises);
        setAllProducts(products.filter(p => p.productId > 0 || p.name !== ""));
    } catch (error) {
        console.error("Failed to fetch from blockchain", error);
        setStatusMessage({ text: "Could not load data from the blockchain. Check console.", isError: true }); 
    } finally { 
        setIsLoading(false); 
    }
  }, [user]);

  useEffect(() => {
    fetchBlockchainData();
  }, [fetchBlockchainData]);

  // Memoized filters for product lists
  const incomingProducts = useMemo(() => {
    if (!user) return [];
    const userAddress = ethers.getAddress(user.wallet);
    return allProducts.filter(p => 
        ethers.getAddress(p.destinationAddress) === userAddress &&
        p.currentState.toString() === '1' // State.IN_TRANSIT
    );
  }, [allProducts, user]);

  const productsInStock = useMemo(() => {
    if (!user) return [];
    const userAddress = ethers.getAddress(user.wallet);
    return allProducts.filter(p => 
        ethers.getAddress(p.currentOwner) === userAddress &&
        p.currentState.toString() === '5' && // State.AT_RETAILER
        Number(p.quantity) > 0
    );
  }, [allProducts, user]);

  const productsShipped = useMemo(() => {
    if (!user) return {};
    const userAddress = ethers.getAddress(user.wallet);
    const shipped = allProducts.filter(p =>
        p.currentState.toString() === '1' && // State is IN_TRANSIT
        p.history.length > 0 &&
        ethers.getAddress(p.history[0].actor) === userAddress // The FIRST actor in its history was you
    );

    const groupedByDate = shipped.reduce((acc, product) => {
        const shippedEvent = product.history.find(h => h.details.includes("Split from"));
        const date = shippedEvent ? new Date(Number(shippedEvent.timestamp) * 1000).toLocaleDateString() : 'Unknown Date';
        if (!acc[date]) { acc[date] = []; }
        acc[date].push(product);
        return acc;
    }, {});
    return groupedByDate;
  }, [allProducts, user]);


  const productsSold = useMemo(() => {
    if (!user) return {};
    const userAddress = ethers.getAddress(user.wallet);
    const sold = allProducts.filter(p =>
        p.currentState.toString() === '7' && // State.SOLD
        p.history.length > 0 &&
        ethers.getAddress(p.history[0].actor) === userAddress
    );

    const groupedByDate = sold.reduce((acc, product) => {
        const soldEvent = product.history[0];
        const date = soldEvent ? new Date(Number(soldEvent.timestamp) * 1000).toLocaleDateString() : 'Unknown Date';
        if (!acc[date]) { acc[date] = []; }
        acc[date].push(product);
        return acc;
    }, {});
    return groupedByDate;
  }, [allProducts, user]);

  // Blockchain Interaction Handlers
  const handleReceiveProduct = async (productId) => {
    setIsProcessing(true);
    setStatusMessage({ text: `Receiving product #${productId}...`, isError: false });
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, supplyChainAbi, signer);
      
      const tx = await contract.receiveProduct(productId);
      await tx.wait();
      setStatusMessage({ text: `Product #${productId} received successfully! Refreshing...`, isError: false });
      setTimeout(() => fetchBlockchainData(), 2000);
    } catch (err) {
      setStatusMessage({ text: "Failed to receive product. " + (err.reason || err.message), isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSellProduct = async (e) => {
    e.preventDefault();
    if (!productToSell || !sellDetails.quantity || Number(sellDetails.quantity) <= 0) return;
    setIsProcessing(true);
    setStatusMessage({ text: "Processing sale...", isError: false });
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(contractAddress, supplyChainAbi, signer);

        const tx = await contract.sellProduct(
            productToSell.productId,
            ethers.parseUnits(sellDetails.quantity, 0)
        );
        await tx.wait();
        setStatusMessage({ text: "Product sold successfully! Refreshing...", isError: false });
        setIsSellModalOpen(false);
        setTimeout(() => fetchBlockchainData(), 2000);
    } catch(err) {
        setStatusMessage({ text: "Failed to sell product. " + (err.reason || err.message), isError: true });
    } finally {
        setIsProcessing(false);
    }
  };
  
  const handleGenerateQrCode = async (product) => {
    const url = `${window.location.origin}/scan-product?id=${product.productId.toString()}`;
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 300, errorCorrectionLevel: 'H' });
      setQrCodeUrl(dataUrl);
      setQrProductName(product.name);
      setIsQrModalOpen(true);
    } catch (err) {
      setStatusMessage({ text: "Could not generate QR code.", isError: true });
    }
  };
  
  const formatTimestamp = (unixTimestamp) => new Date(Number(unixTimestamp) * 1000).toLocaleString();

  // Auth Guards
  if (authLoading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  if (!user) {
    return (
        <div className="flex flex-col justify-center items-center min-h-screen text-center">
            <p className="text-xl mb-4">You are not logged in.</p>
            <Link href="/login" className="bg-green-600 text-white hover:bg-green-700 rounded-full px-8 py-3 font-semibold">
                Go to Login
            </Link>
        </div>
    );
  }
  if (user.role !== "Retailer") {
    return (
        <div className="flex flex-col justify-center items-center min-h-screen text-center">
            <p className="text-xl mb-4">Access Denied</p>
            <p className="text-gray-600 mb-6">
                Your role (<strong>{user.role}</strong>) does not have permission to access this page.
            </p>
            <Link href="/" className="bg-blue-600 text-white hover:bg-blue-700 rounded-full px-8 py-3 font-semibold">
                Go Back Home
            </Link>
        </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="w-full py-4 px-6 bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
                <Leaf className="w-7 h-7 text-green-600" />
                <span className="font-bold text-lg text-gray-800">AgriChain Retailer</span>
            </Link>
            <div className="flex items-center gap-4">
                <span className="hidden sm:inline text-gray-700 font-medium">Welcome, {user.name}</span>
                <button onClick={handleLogout} className="flex items-center gap-2 p-2 bg-red-500 text-white rounded-md hover:bg-red-600">
                    <LogOut className="w-4 h-4" />Logout
                </button>
            </div>
        </div>
      </header>
      
      <main className="flex-grow p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Retailer Dashboard</h1>
          {isLoading ? ( <div className="text-center py-8"><Loader2 className="animate-spin h-8 w-8 text-green-600 mx-auto" /></div> ) : (
            <div className="bg-white p-6 rounded-xl shadow-md">
              <div className="border-b border-gray-200 mb-6">
                  <nav className="flex gap-6">
                      <button onClick={() => setActiveTab('incoming')} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'incoming' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Incoming Shipments ({incomingProducts.length})</button>
                      <button onClick={() => setActiveTab('stock')} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'stock' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Products In Stock ({productsInStock.length})</button>
                      <button onClick={() => setActiveTab('sold')} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'sold' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Sold Items</button>
                  </nav>
              </div>
              {statusMessage.text && <div className={`mb-4 p-3 rounded-md text-sm ${statusMessage.isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{statusMessage.text}</div>}

              {activeTab === 'incoming' && (
                <div className="space-y-4">
                  {incomingProducts.map(p => (
                    <div key={p.productId.toString()} className="bg-gray-50 border rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Truck className="w-8 h-8 text-yellow-500"/>
                        <div>
                          <span className="font-bold">{p.name}</span> <span className="text-xs text-gray-400">#{p.productId.toString()}</span>
                          <p className="text-sm text-gray-600">{p.quantity.toString()} {p.unit}</p>
                        </div>
                      </div>
                      <button onClick={() => handleReceiveProduct(p.productId)} disabled={isProcessing} className="inline-flex items-center gap-2 bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-green-300">
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4"/>} Receive
                      </button>
                    </div>
                  ))}
                  {incomingProducts.length === 0 && <p className="text-center py-4 text-gray-500">No incoming shipments.</p>}
                </div>
              )}

              {activeTab === 'stock' && (
                <div className="space-y-4">
                  {productsInStock.map(p => (
                    <div key={p.productId.toString()} className="bg-gray-50 border rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Package className="w-8 h-8 text-green-600"/>
                        <div>
                           <span className="font-bold">{p.name}</span> <span className="text-xs text-gray-400">#{p.productId.toString()}</span>
                           <p className="text-sm text-gray-600">Available: {p.quantity.toString()} {p.unit}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                          <button onClick={() => handleGenerateQrCode(p)} className="inline-flex items-center gap-2 bg-gray-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-700">
                              <QrCode className="w-4 h-4"/>QR
                          </button>
                          <button onClick={() => { setProductToSell(p); setIsSellModalOpen(true); }} className="inline-flex items-center gap-2 bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-700">
                              <ShoppingCart className="w-4 h-4"/>Sell
                          </button>
                      </div>
                    </div>
                  ))}
                   {productsInStock.length === 0 && <p className="text-center py-4 text-gray-500">No products currently in stock.</p>}
                </div>
              )}
                
              {activeTab === 'sold' && (
                <div className="space-y-6">
                    {Object.keys(productsSold).length > 0 ? (
                        Object.keys(productsSold).sort((a, b) => new Date(b) - new Date(a)).map(date => (
                            <div key={date}>
                                <h3 className="text-lg font-semibold text-gray-700 mb-3">{date}</h3>
                                <div className="space-y-4">
                                    {productsSold[date].map(p => (
                                        <div key={p.productId.toString()} className="bg-gray-50 border rounded-lg p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-4 flex-grow">
                                                <div className="flex-shrink-0"><CheckCircleIcon className="w-8 h-8 text-green-600"/></div>
                                                <div className="flex-grow">
                                                    <div><span className="font-bold text-gray-800">{p.name}</span><span className="text-xs text-gray-400 ml-2">#{p.productId.toString()}</span></div>
                                                    <p className="text-sm text-gray-600">{p.quantity.toString()} {p.unit} sold</p>
                                                </div>
                                            </div>
                                            <div className="text-xs font-semibold text-green-800 bg-green-100 px-3 py-1 rounded-full">
                                                SOLD
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center py-4 text-gray-500">No products have been sold yet.</p>
                    )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* --- MODALS --- */}
      {isQrModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm text-center p-6 relative">
             <button onClick={() => setIsQrModalOpen(false)} className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"><X className="w-5 h-5" /></button>
             <h3 className="text-xl font-semibold mb-4">{qrProductName}</h3>
             {qrCodeUrl ? <img src={qrCodeUrl} alt={`QR Code`} className="mx-auto border p-2" /> : <Loader2 className="animate-spin h-8 w-8 mx-auto" />}
             <p className="text-sm text-gray-500 mt-4">Scan to view traceability.</p>
          </div>
        </div>
      )}

      {isSellModalOpen && productToSell && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                <div className="p-6 border-b"><h3 className="text-xl font-semibold">Sell "{productToSell.name}"</h3></div>
                <form onSubmit={handleSellProduct} className="p-6 space-y-5">
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">Available Quantity</label>
                        <p className="text-lg font-semibold">{productToSell.quantity.toString()} {productToSell.unit}</p>
                    </div>
                    <div>
                        <label htmlFor="sellQuantity" className="text-sm font-medium text-gray-700 block mb-1">Quantity to Sell</label>
                        <input id="sellQuantity" type="number" max={productToSell.quantity.toString()} value={sellDetails.quantity} onChange={(e) => setSellDetails({quantity: e.target.value})} className="w-full border-gray-300 rounded-md p-2 shadow-sm" required/>
                    </div>
                    <div className="pt-4 flex justify-end gap-3 border-t mt-6">
                        <button type="button" onClick={() => setIsSellModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-md">Cancel</button>
                        <button type="submit" disabled={isProcessing} className="px-4 py-2 bg-red-600 text-white rounded-md">{isProcessing ? "Processing..." : "Confirm Sale"}</button>
                    </div>
                </form>
            </div>
        </div>
      )}
      
      <Footer />
    </div>
  );
}

