"use client"
import Link from "next/link";
import { ethers } from "ethers";
import Footer from "../../components/Footer/page";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from '../../context/AuthContext';
import { contractAddress, supplyChainAbi } from "../../lib/contract-config";
import { Leaf, LogOut, Package, Truck, Loader2, Search, X, Factory, QrCode, CheckCircle, RefreshCw, Layers } from "lucide-react";
import QRCode from 'qrcode';

export default function ProcessingUnitDashboard() {
  const { user, logout, loading: authLoading } = useAuth();

  // State for data from blockchain
  const [allProducts, setAllProducts] = useState([]);
  const [actorMap, setActorMap] = useState(new Map());

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stock');
  const [statusMessage, setStatusMessage] = useState({ text: "", isError: false });

  // Modals State
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [productToProcess, setProductToProcess] = useState(null);
  const [processedProduct, setProcessedProduct] = useState({ name: '', quantity: '', unit: 'kg', quantityToProcess: '' });
  
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [recipeOutput, setRecipeOutput] = useState({ name: '', quantity: '', unit: 'kg' });
  const [selectedProductsForRecipe, setSelectedProductsForRecipe] = useState([]);
  
  const [isShipModalOpen, setIsShipModalOpen] = useState(false);
  const [productToShip, setProductToShip] = useState(null);
  const [shipmentDetails, setShipmentDetails] = useState({ quantity: '' });

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [qrProductName, setQrProductName] = useState('');

  // Shipping UI State
  const [destinationRole, setDestinationRole] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActor, setSelectedActor] = useState(null);
  
  // Async Operations State
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Static Data
  const shippableRoles = ['Retailer', 'Warehouse'];
  const units = ['g', 'kg', 'quintal', 'tonne', 'liters', 'packets', 'pieces'];

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
        setStatusMessage({ text: "Could not load data from the blockchain. Check console for details.", isError: true }); 
    } finally { 
        setIsLoading(false); 
    }
  }, [user]);

  useEffect(() => {
    fetchBlockchainData();
  }, [fetchBlockchainData]);

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
        p.currentState.toString() === '4' && // State.AT_PROCESSING_UNIT
        Number(p.quantity) > 0
    );
  }, [allProducts, user]);

  const productsShipped = useMemo(() => {
    if (!user) return {};
    const userAddress = ethers.getAddress(user.wallet);
    const shipped = allProducts.filter(p =>
        p.history.length > 0 &&
        ethers.getAddress(p.history[0].actor) === userAddress &&
        p.currentState.toString() !== '4'
    );
    const groupedByDate = shipped.reduce((acc, product) => {
        const shippedEvent = product.history.find(h => h.details.includes("Split from") || h.details.includes("Created from"));
        const date = shippedEvent ? new Date(Number(shippedEvent.timestamp) * 1000).toLocaleDateString() : 'Unknown Date';
        if (!acc[date]) { acc[date] = []; }
        acc[date].push(product);
        return acc;
    }, {});
    return groupedByDate;
  }, [allProducts, user]);

  const filteredActors = useMemo(() => {
    if (!destinationRole) return [];
    return Array.from(actorMap.values()).filter(actor => 
        shippableRoles.includes(actor.role) && 
        actor.role === destinationRole && 
        actor.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [actorMap, destinationRole, searchTerm]);

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

  const handleProcessProduct = async (e) => {
    e.preventDefault();
    if (!productToProcess) return;
    setIsProcessing(true);
    setStatusMessage({ text: "Processing product...", isError: false });
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(contractAddress, supplyChainAbi, signer);

        const tx = await contract.processProduct(
            productToProcess.productId,
            ethers.parseUnits(processedProduct.quantityToProcess, 0),
            processedProduct.name,
            ethers.parseUnits(processedProduct.quantity, 0),
            processedProduct.unit
        );
        await tx.wait();
        setStatusMessage({ text: "Product processed successfully! Refreshing...", isError: false });
        setIsProcessModalOpen(false);
        setTimeout(() => fetchBlockchainData(), 2000);
    } catch (err) {
        setStatusMessage({ text: "Failed to process product. " + (err.reason || err.message), isError: true });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleRecipeSubmit = async (e) => {
    e.preventDefault();
    for (const ing of recipeIngredients) {
        if (!ing.quantityToUse || Number(ing.quantityToUse) <= 0 || Number(ing.quantityToUse) > Number(ing.quantity)) {
            setStatusMessage({text: `Invalid quantity for ${ing.name}.`, isError: true});
            return;
        }
    }
    setIsProcessing(true);
    setStatusMessage({ text: "Processing with recipe...", isError: false });
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(contractAddress, supplyChainAbi, signer);

        const ingredientIds = recipeIngredients.map(ing => ing.productId);
        const quantitiesToUse = recipeIngredients.map(ing => ethers.parseUnits(ing.quantityToUse, 0));

        const tx = await contract.processWithRecipe(
            ingredientIds, quantitiesToUse,
            recipeOutput.name, ethers.parseUnits(recipeOutput.quantity, 0), recipeOutput.unit
        );
        await tx.wait();
        setStatusMessage({ text: "Recipe processed successfully! Refreshing...", isError: false });
        setIsRecipeModalOpen(false);
        setSelectedProductsForRecipe([]);
        setTimeout(() => fetchBlockchainData(), 2000);
    } catch (err) {
        setStatusMessage({ text: "Failed to process recipe. " + (err.reason || err.message), isError: true });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleShipProduct = async (e) => {
    e.preventDefault();
    if (!selectedActor || !productToShip || !shipmentDetails.quantity || Number(shipmentDetails.quantity) <= 0) return;
    setIsProcessing(true);
    setStatusMessage({ text: "Initiating shipment...", isError: false });
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(contractAddress, supplyChainAbi, signer);
        
        const destinationWalletEntry = Array.from(actorMap.entries()).find(([, value]) => value._id === selectedActor._id);
        const destinationWalletAddress = destinationWalletEntry ? destinationWalletEntry[0] : null;
        if (!destinationWalletAddress) throw new Error("Could not find destination wallet address.");

        const tx = await contract.splitAndShip(productToShip.productId, ethers.parseUnits(shipmentDetails.quantity, 0), destinationWalletAddress);
        await tx.wait();
        setStatusMessage({ text: "Product shipped successfully! Refreshing...", isError: false });
        resetShipModal();
        setTimeout(() => fetchBlockchainData(), 2000);
    } catch (err) {
        setStatusMessage({ text: "Failed to ship product. " + (err.reason || err.message), isError: true });
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

  const resetShipModal = () => { setIsShipModalOpen(false); setProductToShip(null); setDestinationRole(''); setSearchTerm(''); setSelectedActor(null); setShipmentDetails({ quantity: '' }); };
  const handleProductSelectForRecipe = (product) => {
    setSelectedProductsForRecipe(prev => {
        const isSelected = prev.some(p => p.productId === product.productId);
        if (isSelected) return prev.filter(p => p.productId !== product.productId);
        else return [...prev, product];
    });
  };
  const openRecipeModal = () => {
    // FIX: Manually construct the recipe ingredient objects
    setRecipeIngredients(selectedProductsForRecipe.map(p => ({
        productId: p.productId,
        name: p.name,
        quantity: p.quantity,
        unit: p.unit,
        quantityToUse: p.quantity.toString() 
    })));
    setRecipeOutput({ name: '', quantity: '', unit: 'kg' });
    setIsRecipeModalOpen(true);
  };
  const updateRecipeIngredientQuantity = (productId, newQuantity) => {
    setRecipeIngredients(prev => prev.map(ing => ing.productId === productId ? { ...ing, quantityToUse: newQuantity } : ing));
  };
  const formatTimestamp = (unixTimestamp) => new Date(Number(unixTimestamp) * 1000).toLocaleString();

  if (authLoading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  if (!user || user.role !== "Processing Unit") return <div className="flex flex-col justify-center items-center min-h-screen text-center"><p>Access Denied</p></div>;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="w-full py-4 px-6 bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
                <Leaf className="w-7 h-7 text-green-600" />
                <span className="font-bold text-lg text-gray-800">AgriChain Processing Unit</span>
            </Link>
            <div className="flex items-center gap-4">
                <span className="hidden sm:inline text-gray-700 font-medium">Welcome, {user.name}</span>
                <button onClick={logout} className="flex items-center gap-2 p-2 bg-red-500 text-white rounded-md hover:bg-red-600">
                    <LogOut className="w-4 h-4" />Logout
                </button>
            </div>
        </div>
      </header>
      
      <main className="flex-grow p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Processing Unit Dashboard</h1>
          {isLoading ? ( <div className="text-center py-8"><Loader2 className="animate-spin h-8 w-8 text-green-600 mx-auto" /></div> ) : (
            <div className="bg-white p-6 rounded-xl shadow-md">
              <div className="border-b border-gray-200 mb-6">
                  <nav className="flex gap-6">
                      <button onClick={() => setActiveTab('incoming')} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'incoming' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Incoming Materials ({incomingProducts.length})</button>
                      <button onClick={() => setActiveTab('stock')} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'stock' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Products In Stock ({productsInStock.length})</button>
                      <button onClick={() => setActiveTab('shipped')} className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'shipped' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Shipped Products</button>
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
                  {incomingProducts.length === 0 && <p className="text-center py-4 text-gray-500">No incoming materials.</p>}
                </div>
              )}

              {activeTab === 'stock' && (
                <div>
                  <div className="flex justify-end mb-4">
                      <button 
                          onClick={openRecipeModal}
                          disabled={selectedProductsForRecipe.length < 1}
                          className="inline-flex items-center gap-2 bg-teal-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal-700 disabled:bg-gray-300"
                      >
                          <Layers className="w-4 h-4"/> Process with Recipe ({selectedProductsForRecipe.length})
                      </button>
                  </div>
                  <div className="space-y-4">
                    {productsInStock.map(p => (
                      <div key={p.productId.toString()} className="bg-gray-50 border rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <input 
                              type="checkbox"
                              className="h-5 w-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                              checked={selectedProductsForRecipe.some(sp => sp.productId.toString() === p.productId.toString())}
                              onChange={() => handleProductSelectForRecipe(p)}
                           />
                           <Factory className="w-8 h-8 text-green-600"/>
                           <div>
                              <span className="font-bold">{p.name}</span> <span className="text-xs text-gray-400">#{p.productId.toString()}</span>
                              <p className="text-sm text-gray-600">Available: {p.quantity.toString()} {p.unit}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => { setProductToProcess(p); setIsProcessModalOpen(true); }} className="inline-flex items-center gap-2 bg-purple-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-purple-700">
                                <RefreshCw className="w-4 h-4"/>Process
                            </button>
                            <button onClick={() => handleGenerateQrCode(p)} className="inline-flex items-center gap-2 bg-gray-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-700">
                                <QrCode className="w-4 h-4"/>QR
                            </button>
                            <button onClick={() => { setProductToShip(p); setIsShipModalOpen(true); }} className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700">
                                <Truck className="w-4 h-4"/>Ship
                            </button>
                        </div>
                      </div>
                    ))}
                     {productsInStock.length === 0 && <p className="text-center py-4 text-gray-500">No products currently in stock.</p>}
                  </div>
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
                                                            <CheckCircle className="w-3 h-3"/> Received
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
                        <p className="text-center py-4 text-gray-500">You have not shipped any products yet.</p>
                    )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* --- MODALS --- */}
      {isProcessModalOpen && productToProcess && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                <div className="p-6 border-b"><h3 className="text-xl font-semibold">Process "{productToProcess.name}"</h3></div>
                <form onSubmit={handleProcessProduct} className="p-6 space-y-5">
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">Quantity to Process <span className="text-gray-500">(Max: {productToProcess.quantity.toString()})</span></label>
                        <input type="number" max={productToProcess.quantity.toString()} value={processedProduct.quantityToProcess} onChange={(e) => setProcessedProduct({...processedProduct, quantityToProcess: e.target.value})} className="w-full border-gray-300 rounded-md p-2 shadow-sm" required/>
                    </div>
                    <hr />
                    <div><h4 className="text-md font-semibold text-gray-800">New Output Product</h4></div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">New Product Name</label>
                        <input type="text" value={processedProduct.name} onChange={(e) => setProcessedProduct({...processedProduct, name: e.target.value})} className="w-full border-gray-300 rounded-md p-2 shadow-sm" required/>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">New Quantity & Unit</label>
                        <div className="mt-1 grid grid-cols-3 gap-2">
                            <input type="number" value={processedProduct.quantity} onChange={(e) => setProcessedProduct({...processedProduct, quantity: e.target.value})} className="col-span-2 border-gray-300 rounded-md p-2 shadow-sm" required/>
                            <select value={processedProduct.unit} onChange={(e) => setProcessedProduct({...processedProduct, unit: e.target.value})} className="col-span-1 border-gray-300 rounded-md p-2 shadow-sm bg-white">
                                {units.map(u => (<option key={u} value={u}>{u}</option>))}
                            </select>
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end gap-3 border-t mt-6">
                        <button type="button" onClick={() => setIsProcessModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-md">Cancel</button>
                        <button type="submit" disabled={isProcessing} className="px-4 py-2 bg-purple-600 text-white rounded-md">{isProcessing ? "Processing..." : "Confirm & Process"}</button>
                    </div>
                </form>
            </div>
        </div>
      )}
      
      {isRecipeModalOpen && (
         <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                <div className="p-6 border-b"><h3 className="text-xl font-semibold">Combine & Process with Recipe</h3></div>
                <form onSubmit={handleRecipeSubmit} className="p-6">
                    <div className="space-y-4">
                        <div>
                            <h4 className="text-lg font-medium text-gray-800 mb-2">Ingredients ({recipeIngredients.length})</h4>
                            <div className="space-y-3 max-h-48 overflow-y-auto pr-2 border p-2 rounded-md bg-gray-50">
                                {recipeIngredients.map(ing => (
                                    <div key={ing.productId.toString()} className="grid grid-cols-2 gap-4 items-center">
                                        <p className="font-medium">{ing.name} <span className="text-xs text-gray-400">(Avail: {ing.quantity.toString()})</span></p>
                                        <div>
                                            <label className="text-xs font-medium text-gray-600">Quantity to Use</label>
                                            <input type="number" max={ing.quantity.toString()} value={ing.quantityToUse} onChange={(e) => updateRecipeIngredientQuantity(ing.productId, e.target.value)} className="w-full border-gray-300 rounded-md p-2 shadow-sm" required/>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <hr />
                        <div>
                            <h4 className="text-lg font-medium text-gray-800 mb-2">Output Product</h4>
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1">New Product Name</label>
                                <input type="text" value={recipeOutput.name} onChange={(e) => setRecipeOutput({...recipeOutput, name: e.target.value})} className="w-full border-gray-300 rounded-md p-2 shadow-sm" required/>
                            </div>
                            <div className="mt-4">
                                <label className="text-sm font-medium text-gray-700 block mb-1">New Quantity & Unit</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <input type="number" value={recipeOutput.quantity} onChange={(e) => setRecipeOutput({...recipeOutput, quantity: e.target.value})} className="col-span-2 border-gray-300 rounded-md p-2 shadow-sm" required/>
                                    <select value={recipeOutput.unit} onChange={(e) => setRecipeOutput({...recipeOutput, unit: e.target.value})} className="col-span-1 border-gray-300 rounded-md p-2 shadow-sm bg-white">
                                        {units.map(u => (<option key={u} value={u}>{u}</option>))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="pt-6 flex justify-end gap-3 border-t mt-6">
                        <button type="button" onClick={() => { setIsRecipeModalOpen(false); setSelectedProductsForRecipe([]); }} className="px-4 py-2 bg-gray-200 rounded-md">Cancel</button>
                        <button type="submit" disabled={isProcessing} className="px-4 py-2 bg-teal-600 text-white rounded-md">{isProcessing ? "Processing..." : "Confirm & Process"}</button>
                    </div>
                </form>
            </div>
        </div>
      )}

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

      {isShipModalOpen && productToShip && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                <div className="p-6 border-b"><h3 className="text-xl font-semibold">Ship Batch #{productToShip.productId.toString()}</h3></div>
                <form onSubmit={handleShipProduct} className="p-6 space-y-6">
                    <div>
                        <label className="text-sm font-medium text-gray-500">Product</label>
                        <p className="text-lg font-semibold">{productToShip.name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="text-sm font-medium text-gray-500">Available Quantity</label>
                            <p className="text-lg font-semibold">{productToShip.quantity.toString()} {productToShip.unit}</p>
                        </div>
                        <div>
                            <label htmlFor="shipQuantity" className="text-sm font-medium text-gray-700 block mb-1">Quantity to Ship</label>
                            <div className="flex items-center">
                                <input id="shipQuantity" type="number" max={productToShip.quantity.toString()} value={shipmentDetails.quantity} onChange={(e) => setShipmentDetails({...shipmentDetails, quantity: e.target.value})} className="w-full rounded-l-md" required/>
                                <span className="inline-flex items-center px-3 text-sm bg-gray-100 border border-l-0 rounded-r-md h-10">{productToShip.unit}</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">Destination</label>
                        <div className="space-y-3 p-4 border rounded-md bg-gray-50">
                            {selectedActor ? (
                                <div className="flex justify-between items-center"><div className="font-medium text-green-700">{selectedActor.name} ({selectedActor.role})</div><button type="button" onClick={() => setSelectedActor(null)} className="p-1 text-red-500 hover:bg-red-100 rounded-full"><X className="w-4 h-4"/></button></div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="destRole" className="text-xs font-medium">Step 1: Type</label>
                                            <select id="destRole" value={destinationRole} onChange={(e) => {setDestinationRole(e.target.value); setSearchTerm('');}} className="w-full rounded-md">
                                                <option value="">-- Select Role --</option>
                                                {shippableRoles.map(r => (<option key={r} value={r}>{r}</option>))}
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="destSearch" className="text-xs font-medium">Step 2: Name</label>
                                            <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"/><input id="destSearch" type="text" placeholder="Search..." disabled={!destinationRole} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 rounded-md"/></div>
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
                    <div className="pt-6 flex justify-end gap-3 border-t mt-6">
                        <button type="button" onClick={resetShipModal} className="px-4 py-2 bg-gray-200 rounded-md">Cancel</button>
                        <button type="submit" disabled={isProcessing || !selectedActor} className="px-4 py-2 bg-blue-600 text-white rounded-md">{isProcessing ? "Shipping..." : "Confirm & Ship"}</button>
                    </div>
                </form>
            </div>
        </div>
      )}
      
      <Footer />
    </div>
  );
}

